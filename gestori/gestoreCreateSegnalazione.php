<?php
session_start();
if (!isset($_SESSION['userId'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}

include '../database/conn.php';

// Recupera i dati dal form
$idU = $_SESSION['userId'];
$regione = isset($_POST['regione']) ? $_POST['regione'] : null;
$provincia = isset($_POST['provincia']) ? $_POST['provincia'] : null;
$comune = isset($_POST['comune']) ? $_POST['comune'] : null;
$via = isset($_POST['via']) ? $_POST['via'] : null;
$civico = isset($_POST['civico']) ? $_POST['civico'] : null;
$tipo = isset($_POST['tipo']) ? $_POST['tipo'] : null;
$descrizione = isset($_POST['descrizione']) ? $_POST['descrizione'] : null;
$foto = isset($_FILES['foto']) ? $_FILES['foto'] : null;

// Verifica che tutti i campi siano stati inviati
if (!$regione || !$provincia || !$comune || !$via || !$civico || !$tipo) {
    die("Errore: tutti i campi sono obbligatori.");
}

// Gestione del caricamento della foto
$foto = '';
if (!empty($_FILES['foto']['name'])) {
    // Verifica che il file sia un'immagine
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    $fileType = mime_content_type($_FILES['foto']['tmp_name']);
    if (!in_array($fileType, $allowedTypes)) {
        die("Errore: il file caricato non è un'immagine valida.");
    }

    // Genera un nome univoco per la foto
    $foto = 'assets/img/' . uniqid() . '_' . basename($_FILES['foto']['name']);

    // Verifica che la directory esista e abbia i permessi corretti
    $uploadDir = '../assets/img/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true); // Crea la directory se non esiste
    }

    // Sposta il file nella directory specificata
    if (!move_uploaded_file($_FILES['foto']['tmp_name'], $uploadDir . basename($foto))) {
        die("Errore nel caricamento della foto.");
    }
}

// Prepara la query per inserire i dati nel database
$stmt = $conn->prepare("
    INSERT INTO segnalazioni (idUtente, regione, provincia, comune, via, civico, tipo, descrizione, foto) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("issssisss", $idU, $regione, $provincia, $comune, $via, $civico, $tipo, $descrizione, $foto);

// Esegui la query
if ($stmt->execute()) {
    header("Location: ../pagine/home.php");
    exit();
} else {
    die("Errore durante l'inserimento della segnalazione: " . $stmt->error);
}