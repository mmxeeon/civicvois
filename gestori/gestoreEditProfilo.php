<?php
session_start();
include '../database/conn.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $userId = $_SESSION['userId'];
    $nome = trim($_POST['nome']);
    $cognome = trim($_POST['cognome']);
    $email = trim($_POST['email']);
    $bio = trim($_POST['bio']);
    $fotoProfilo = $_FILES['fotoProfilo'];
    $oldPassword = $_POST['oldPassword'];
    $newPassword = $_POST['newPassword'];
    $confirmPassword = $_POST['confirmPassword'];

    // Verifica se l'utente ha inserito una nuova password
    if (!empty($newPassword) || !empty($confirmPassword)) {
        // Controlla che la nuova password e la conferma coincidano
        if ($newPassword !== $confirmPassword) {
            $_SESSION['error'] = "Le nuove password non coincidono.";
            header("Location: ../pagine/editProfilo.php");
            exit();
        }

        // Verifica la password attuale
        $stmt = $conn->prepare("SELECT passwd FROM utenti WHERE id = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $stmt->bind_result($hashedPassword);
        $stmt->fetch();
        $stmt->close();

        if (md5($oldPassword) !== $hashedPassword) {
            $_SESSION['error'] = "La password attuale non è corretta.";
            header("Location: ../pagine/editProfilo.php");
            exit();
        }

        // Aggiorna la password
        $newHashedPassword = md5($newPassword);
        $stmt = $conn->prepare("UPDATE utenti SET passwd = ? WHERE id = ?");
        $stmt->bind_param("si", $newHashedPassword, $userId);
        $stmt->execute();
        $stmt->close();
    }

    // Salva la foto profilo
    $fotoProfiloPath = null;
    if (!empty($fotoProfilo['name'])) {
        $targetDir = "../assets/img/";
        $fileName = uniqid() . "_" . basename($fotoProfilo['name']);
        $targetFilePath = $targetDir . $fileName;
        $fileType = strtolower(pathinfo($targetFilePath, PATHINFO_EXTENSION));

        // Controlla il tipo di file
        $allowedTypes = ['jpg', 'jpeg', 'png', 'gif'];
        if (!in_array($fileType, $allowedTypes)) {
            $_SESSION['error'] = "Formato immagine non supportato. Usa JPG, JPEG, PNG o GIF.";
            header("Location: ../pagine/editProfilo.php");
            exit();
        }

        // Sposta il file nella cartella di destinazione
        if (!move_uploaded_file($fotoProfilo['tmp_name'], $targetFilePath)) {
            $_SESSION['error'] = "Errore nel caricamento della foto profilo.";
            header("Location: ../pagine/editProfilo.php");
            exit();
        }

        // Salva il percorso relativo della foto
        $fotoProfiloPath = "assets/img/" . $fileName;

        // Aggiorna il percorso della foto nel database
        $stmt = $conn->prepare("UPDATE utenti SET fotoProfilo = ? WHERE id = ?");
        $stmt->bind_param("si", $fotoProfiloPath, $userId);
        $stmt->execute();
        $stmt->close();
    }

    // Aggiorna le altre informazioni dell'utente
    $stmt = $conn->prepare("UPDATE utenti SET nome = ?, cognome = ?, email = ?, bio = ? WHERE id = ?");
    $stmt->bind_param("ssssi", $nome, $cognome, $email, $bio, $userId);
    $stmt->execute();
    $stmt->close();

    $_SESSION['success'] = "Profilo aggiornato con successo.";
    header("Location: ../pagine/profilo.php");
    exit();
}
?>
