@echo off
set "root=civicvois"

mkdir %root%
cd %root%

mkdir autenticazione
mkdir database
mkdir pagine
mkdir gestori
mkdir db
mkdir ajax
mkdir assets
mkdir assets\css
mkdir assets\js
mkdir assets\img

type nul > index.php
type nul > README.md

echo Struttura del progetto "Civicvois" creata con successo.
pause
