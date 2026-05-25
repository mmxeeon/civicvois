#!/usr/bin/env node
// Costruisce la cartella `www/` che Capacitor copierà nelle app native iOS/Android.
// Mantiene la stessa struttura del sito statico ma esclude file/cartelle che
// non devono finire dentro l'app (backend Netlify, node_modules, ios/android, ecc.).

import { cpSync, mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "www");

const COPY_ITEMS = [
  "index.html",
  "manifest.webmanifest",
  "assets"
  // service-worker.js → escluso: dentro l'app nativa non è registrato e non serve
];

function clean() {
  if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
}

function copyAll() {
  for (const item of COPY_ITEMS) {
    const src = path.join(ROOT, item);
    if (!existsSync(src)) {
      console.warn(`[build-web] mancante: ${item} — salto`);
      continue;
    }
    const dest = path.join(OUT, item);
    cpSync(src, dest, { recursive: true });
    console.log(`[build-web] copiato ${item} → www/${item}`);
  }
}

function writeMarker() {
  const marker = {
    builtAt: new Date().toISOString(),
    apiBaseUrl: "https://civicvois.it/.netlify/functions"
  };
  writeFileSync(path.join(OUT, "build-info.json"), JSON.stringify(marker, null, 2));
}

clean();
copyAll();
writeMarker();
console.log("[build-web] OK → www/");
