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

// Verifica che tutti i campi siano stati inviati
if (!$regione || !$provincia || !$comune || !$via || !$civico || !$tipo) {
    die("Errore: tutti i campi sono obbligatori.");
}

// Gestione del caricamento della foto
$foto = '';
if (!empty($_FILES['foto']['name'])) {
    $foto = 'assets/img/' . basename($_FILES['foto']['name']);
    if (!move_uploaded_file($_FILES['foto']['tmp_name'], '../' . $foto)) {
        die("Errore nel caricamento della foto.");
    }
}

// Prepara la query per inserire i dati nel database
$stmt = $conn->prepare("
    INSERT INTO segnalazioni (idUtente, regione, provincia, comune, via, civico, tipo, foto) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
");
$stmt->bind_param("issssiss", $idU, $regione, $provincia, $comune, $via, $civico, $tipo, $foto);

// Esegui la query
if ($stmt->execute()) {
    header("Location: ../pagine/home.php");
    exit();
} else {
    die("Errore durante l'inserimento della segnalazione: " . $stmt->error);
}