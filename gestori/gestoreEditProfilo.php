<?php
session_start();
require_once '../database/conn.php';

// Controllo sessione userId
if (!isset($_SESSION['userId'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit;
}
$userId = $_SESSION['userId'];

// Recupera fotoProfilo e password MD5 da DB
$stmt = $conn->prepare("SELECT fotoProfilo, password FROM utenti WHERE id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$stmt->bind_result($currentFotoProfilo, $currentHash);
$stmt->fetch();
$stmt->close();

// Dati inviati
$nome        = trim($_POST['nome']);
$cognome     = trim($_POST['cognome']);
$email       = trim($_POST['email']);
$bio         = trim($_POST['bio']);
$oldPassword = $_POST['oldPassword'] ?? '';
$newPassword = $_POST['newPassword'] ?? '';
$confirmPass = $_POST['confirmPassword'] ?? '';
$fotoProfilo = null;

// Validazione campi base
if (empty($nome) || empty($cognome) || empty($email) || empty($oldPassword)) {
    $_SESSION['error'] = "Compila tutti i campi obbligatori e inserisci la password attuale.";
    header("Location: ../pagine/editProfilo.php");
    exit;
}

// Verifica password attuale via MD5
if (md5($oldPassword) !== $currentHash) {
    $_SESSION['error'] = "Password attuale non corretta.";
    header("Location: ../pagine/editProfilo.php");
    exit;
}

// Verifica cambio password
$updateHash = false;
if ($newPassword !== '' || $confirmPass !== '') {
    if ($newPassword !== $confirmPass) {
        $_SESSION['error'] = "Le nuove password non coincidono.";
        header("Location: ../pagine/editProfilo.php");
        exit;
    }
    $updateHash = true;
    $newHash = md5($newPassword);
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
    $dir  = "../assets/img/";
    $file = uniqid() . '_' . basename($_FILES['fotoProfilo']['name']);
    $path = $dir . $file;
    $ext  = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg','jpeg','png','gif'])) {
        $_SESSION['error'] = "Formato file non valido.";
        header("Location: ../pagine/editProfilo.php"); exit;
    }
    if (move_uploaded_file($_FILES['fotoProfilo']['tmp_name'], $path)) {
        $fotoProfilo = "assets/img/" . $file;
        if (!empty($currentFotoProfilo) && file_exists("../" . $currentFotoProfilo)) {
            unlink("../" . $currentFotoProfilo);
        }
    } else {
        $_SESSION['error'] = "Errore durante il caricamento della foto.";
        header("Location: ../pagine/editProfilo.php"); exit;
    }
} else {
    $fotoProfilo = $currentFotoProfilo;
}

// Query update
$sql    = "UPDATE utenti SET nome=?, cognome=?, email=?, bio=?, fotoProfilo=?";
$params = [$nome, $cognome, $email, $bio, $fotoProfilo];
$types  = "sssss";
if ($updateHash) {
    $sql      .= ", password=?";
    $params[] = $newHash;
    $types   .= "s";
}
$sql      .= " WHERE id=?";
$params[]  = $userId;
$types   .= "i";

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
if ($stmt->execute()) {
    $_SESSION['success'] = "Profilo aggiornato con successo.";
    header("Location: ../pagine/profilo.php");
    exit;
} else {
    $_SESSION['error'] = "Errore aggiornamento: " . $stmt->error;
    header("Location: ../pagine/editProfilo.php");
    exit;
}
?>