<?php
session_start();
include '../database/conn.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nome = trim($_POST['nome']);
    $cognome = trim($_POST['cognome']);
    $email = trim($_POST['email']);
    $dataDiNascita = $_POST['dataDiNascita'];
    $username = trim($_POST['username']);
    $password = md5($_POST['password']); // Usa una libreria più sicura in produzione
    $bio = trim($_POST['bio']);
    $fotoProfilo = $_FILES['fotoProfilo'];

    // Controlla se email o username esistono già
    $stmt = $conn->prepare("SELECT COUNT(*) FROM utenti WHERE email = ? OR username = ?");
    $stmt->bind_param("ss", $email, $username);
    $stmt->execute();
    $stmt->bind_result($count);
    $stmt->fetch();
    $stmt->close();

    if ($count > 0) {
        $_SESSION['error'] = "Email o username già esistenti.";
        header("Location: paginaRegistrati.php");
        exit();
    }

    // Salva la foto profilo
    $targetDir = "../assets/img/";
    $fileName = uniqid() . "_" . basename($fotoProfilo['name']);
    $targetFilePath = $targetDir . $fileName;
    $fileType = strtolower(pathinfo($targetFilePath, PATHINFO_EXTENSION));

    // Controlla il tipo di file
    $allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
    if (!in_array($fileType, $allowedTypes)) {
        $_SESSION['error'] = "Formato immagine non supportato. Usa JPG, JPEG, PNG o GIF.";
        header("Location: paginaRegistrati.php");
        exit();
    }

    // Sposta il file nella cartella di destinazione
    if (!move_uploaded_file($fotoProfilo['tmp_name'], $targetFilePath)) {
        $_SESSION['error'] = "Errore nel caricamento della foto profilo.";
        header("Location: paginaRegistrati.php");
        exit();
    }

    // Salva il percorso relativo della foto nel database
    $fotoProfiloPath = "assets/img/" . $fileName;

    // Inserisci l'utente nel database
    $stmt = $conn->prepare("INSERT INTO utenti (nome, cognome, email, dataDiNascita, username, passwd, bio, fotoProfilo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssssss", $nome, $cognome, $email, $dataDiNascita, $username, $password, $bio, $fileName);

    if ($stmt->execute()) {
        $_SESSION['success'] = "Registrazione completata con successo!";
        header("Location: paginaLogin.php");
    } else {
        $_SESSION['error'] = "Errore durante la registrazione.";
        header("Location: paginaRegistrati.php");
    }

    $stmt->close();
    $conn->close();
}
?>
