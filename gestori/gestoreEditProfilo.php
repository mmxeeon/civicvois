<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
require_once '../database/conn.php';

// Verifica che il metodo sia POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("Location: ../pagine/editProfilo.php");
    exit();
}

// Recupera i dati inviati dal form
$nome = trim($_POST['nome']);
$cognome = trim($_POST['cognome']);
$email = trim($_POST['email']);
$bio = trim($_POST['bio']);
$fotoProfilo = null;

// Validazione dei dati
if (empty($nome) || empty($cognome) || empty($email)) {
    $_SESSION['error'] = "Tutti i campi obbligatori devono essere compilati.";
    header("Location: ../pagine/editProfilo.php");
    exit();
}

// Gestione dell'upload della foto profilo
if (!empty($_FILES['fotoProfilo']['name'])) {
    $targetDir = "../uploads/";
    $fileName = uniqid() . "_" . basename($_FILES['fotoProfilo']['name']); // Nome univoco
    $targetFilePath = $targetDir . $fileName;
    $fileType = strtolower(pathinfo($targetFilePath, PATHINFO_EXTENSION));

    // Controlla il tipo di file
    $allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
    if (!in_array($fileType, $allowedTypes)) {
        $_SESSION['error'] = "Formato file non valido. Sono ammessi solo JPG, JPEG, PNG e GIF.";
        header("Location: ../pagine/editProfilo.php");
        exit();
    }

    // Sposta il file nella directory di destinazione
    if (move_uploaded_file($_FILES['fotoProfilo']['tmp_name'], $targetFilePath)) {
        $fotoProfilo = "uploads/" . $fileName; // Percorso relativo da salvare nel database
    } else {
        $_SESSION['error'] = "Errore durante il caricamento della foto.";
        header("Location: ../pagine/editProfilo.php");
        exit();
    }
}

// Aggiorna i dati nel database
$query = "UPDATE utenti SET nome = ?, cognome = ?, email = ?, bio = ?";
$params = [$nome, $cognome, $email, $bio];
$types = "ssss";

if ($fotoProfilo) {
    $query .= ", fotoProfilo = ?";
    $params[] = $fotoProfilo;
    $types .= "s";
}

$query .= " WHERE id = ?";
$params[] = $_SESSION['userId'];
$types .= "i";

$stmt = $conn->prepare($query);
$stmt->bind_param($types, ...$params);
$stmt->execute();

if ($stmt->execute()) {
    $_SESSION['success'] = "Profilo aggiornato con successo.";
    header("Location: ../pagine/profilo.php");
    exit();
} else {
    $_SESSION['error'] = "Errore durante l'aggiornamento del profilo.";
    header("Location: ../pagine/editProfilo.php");
    exit();
}
