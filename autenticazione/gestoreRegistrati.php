<?php
session_start();
include '../database/conn.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nome = trim($_POST['nome']);
    $cognome = trim($_POST['cognome']);
    $email = trim($_POST['email']);
    $dataDiNascita = $_POST['dataDiNascita'];
    $regione = intval($_POST['regione']);
    $provincia = intval($_POST['provincia']);
    $username = trim($_POST['username']);
    $password = md5($_POST['password']);
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

    // Upload foto
    if (!empty($_FILES['fotoProfilo']['name'])) {
        $dir  = "../assets/img/";
        $file = uniqid() . '_' . basename($_FILES['fotoProfilo']['name']);
        $path = $dir . $file;
        $ext  = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif'])) {
            $_SESSION['error'] = "Formato file non valido.";
            header("Location: paginaRegistrati.php");
            exit;
        }
        if (move_uploaded_file($_FILES['fotoProfilo']['tmp_name'], $path)) {
            $fotoProfilo = "assets/img/" . $file;
            if (!empty($currentFotoProfilo) && file_exists("../" . $currentFotoProfilo)) {
                unlink("../" . $currentFotoProfilo);
            }
        } else {
            $_SESSION['error'] = "Errore durante il caricamento della foto.";
            header("Location: paginaRegistrati");
            exit;
        }
    } else {
        $fotoProfilo = $currentFotoProfilo;
    }

    // Inserisci l'utente nel database
    $stmt = $conn->prepare("INSERT INTO utenti (nome, cognome, email, dataDiNascita, regione, provincia, username, passwd, bio, fotoProfilo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssiissss", $nome, $cognome, $email, $dataDiNascita, $regione, $provincia, $username, $password, $bio, $fotoProfilo);

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
