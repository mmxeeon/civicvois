#!/usr/bin/env node
// Prepara le librerie di runtime servite localmente dall'app.
// Evita dipendenze CDN per PWA e bundle Capacitor nativo.

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VENDOR = path.join(ROOT, "assets", "vendor");

function resetDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function copyLeaflet() {
  const leafletOut = path.join(VENDOR, "leaflet");
  resetDir(leafletOut);

  const leafletDist = path.dirname(require.resolve("leaflet/dist/leaflet.js"));
  cpSync(path.join(leafletDist, "leaflet.js"), path.join(leafletOut, "leaflet.js"));
  cpSync(path.join(leafletDist, "leaflet.css"), path.join(leafletOut, "leaflet.css"));
  cpSync(path.join(leafletDist, "images"), path.join(leafletOut, "images"), { recursive: true });
  console.log("[build-vendor] Leaflet copiato in assets/vendor/leaflet");
}

async function bundleSupabase() {
  const supabaseOut = path.join(VENDOR, "supabase");
  resetDir(supabaseOut);

  await build({
    absWorkingDir: ROOT,
    bundle: true,
    entryPoints: ["@supabase/supabase-js"],
    format: "esm",
    legalComments: "none",
    minify: true,
    outfile: path.join(supabaseOut, "supabase-js.js"),
    platform: "browser",
    sourcemap: false,
    target: ["es2020"]
  });

  console.log("[build-vendor] Supabase JS bundlato in assets/vendor/supabase");
}

await bundleSupabase();
copyLeaflet();
