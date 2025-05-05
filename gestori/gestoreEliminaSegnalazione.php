<?php
session_start();
require_once '../database/conn.php';

if (!isset($_SESSION['userId'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}

if (!isset($_GET['id'])) {
    $_SESSION['error'] = "ID segnalazione non valido.";
    header("Location: ../pagine/profilo.php");
    exit();
}

$idSegnalazione = intval($_GET['id']);
$userId = $_SESSION['userId'];

// Controlla che la segnalazione appartenga all'utente
$stmt = $conn->prepare("SELECT id FROM segnalazioni WHERE id = ? AND idUtente = ?");
$stmt->bind_param("ii", $idSegnalazione, $userId);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 0) {
    $_SESSION['error'] = "Segnalazione non trovata o non autorizzato.";
    header("Location: ../pagine/profilo.php");
    exit();
}
$stmt->close();

// Elimina la segnalazione
$stmt = $conn->prepare("DELETE FROM segnalazioni WHERE id = ?");
$stmt->bind_param("i", $idSegnalazione);

if ($stmt->execute()) {
    $_SESSION['success'] = "Segnalazione eliminata con successo.";
} else {
    $_SESSION['error'] = "Errore durante l'eliminazione della segnalazione.";
}

$stmt->close();
$conn->close();

header("Location: ../pagine/profilo.php");
exit();
?>