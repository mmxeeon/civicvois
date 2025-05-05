<?php
session_start();
require_once '../database/conn.php';

if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit;
}

// Ricava l'ID dell'utente
$stmt = $conn->prepare("SELECT id, fotoProfilo FROM utenti WHERE username = ?");
$stmt->bind_param("s", $_SESSION['username']);
$stmt->execute();
$stmt->bind_result($userId, $currentFotoProfilo);
$stmt->fetch();
$stmt->close();

if (!$userId) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit;
}

// Dati inviati
$nome    = trim($_POST['nome']);
$cognome = trim($_POST['cognome']);
$email   = trim($_POST['email']);
$bio     = trim($_POST['bio']);
$fotoProfilo = null;

// Validazione
if (empty($nome) || empty($cognome) || empty($email)) {
    $_SESSION['error'] = "Tutti i campi obbligatori devono essere compilati.";
    header("Location: ../pagine/editProfilo.php");
    exit;
}

// Controlla email duplicata
$stmt = $conn->prepare("SELECT COUNT(*) FROM utenti WHERE email = ? AND id != ?");
$stmt->bind_param("si", $email, $userId);
$stmt->execute();
$stmt->bind_result($count);
$stmt->fetch();
$stmt->close();

if ($count > 0) {
    $_SESSION['error'] = "L'email è già in uso.";
    header("Location: ../pagine/editProfilo.php");
    exit;
}

// Upload foto
if (!empty($_FILES['fotoProfilo']['name'])) {
    $targetDir = "../assets/img/";
    $fileName  = uniqid() . "_" . basename($_FILES['fotoProfilo']['name']);
    $targetFile = $targetDir . $fileName;
    $ext = strtolower(pathinfo($targetFile, PATHINFO_EXTENSION));
    $allowed = ['jpg','jpeg','png','gif'];
    if (!in_array($ext, $allowed)) {
        $_SESSION['error'] = "Formato file non valido.";
        header("Location: ../pagine/editProfilo.php");
        exit;
    }
    if (move_uploaded_file($_FILES['fotoProfilo']['tmp_name'], $targetFile)) {
        $fotoProfilo = "assets/img/" . $fileName;
        if (!empty($currentFotoProfilo) && file_exists("../" . $currentFotoProfilo)) {
            unlink("../" . $currentFotoProfilo);
        }
    } else {
        $_SESSION['error'] = "Errore durante il caricamento della foto.";
        header("Location: ../pagine/editProfilo.php");
        exit;
    }
} else {
    $fotoProfilo = $currentFotoProfilo;
}

// Aggiorna il profilo
$query = "UPDATE utenti 
          SET nome = ?, cognome = ?, email = ?, bio = ?, fotoProfilo = ? 
          WHERE id = ?";
$stmt = $conn->prepare($query);
$stmt->bind_param("sssssi", $nome, $cognome, $email, $bio, $fotoProfilo, $userId);

if ($stmt->execute()) {
    $_SESSION['success'] = "Profilo aggiornato con successo.";
    header("Location: ../pagine/profilo.php");
    exit;
} else {
    $_SESSION['error'] = "Errore durante l'aggiornamento del profilo: " . $stmt->error;
    header("Location: ../pagine/editProfilo.php");
    exit;
}
?>
