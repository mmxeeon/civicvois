<?php
session_start();
require_once '../database/conn.php';

if (!isset($_SESSION['userId'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Non autorizzato']);
    exit();
}

$userId = $_SESSION['userId'];
$idSegnalazione = intval($_POST['idSegnalazione']);

// Controlla se l'utente ha già messo like
$stmt = $conn->prepare("SELECT * FROM interazioni WHERE segnalazione_id = ? AND utente_id = ?");
$stmt->bind_param("ii", $idSegnalazione, $userId);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows > 0) {
    // Rimuovi il like
    $stmt = $conn->prepare("DELETE FROM interazioni WHERE segnalazione_id = ? AND utente_id = ?");
    $stmt->bind_param("ii", $idSegnalazione, $userId);
    $stmt->execute();

    // Conta i like aggiornati
    $stmt = $conn->prepare("SELECT COUNT(*) FROM interazioni WHERE segnalazione_id = ?");
    $stmt->bind_param("i", $idSegnalazione);
    $stmt->execute();
    $stmt->bind_result($count);
    $stmt->fetch();

    echo json_encode(['action' => 'removed', 'interazioni' => $count]);
} else {
    // Aggiungi il like
    $stmt = $conn->prepare("INSERT INTO interazioni (segnalazione_id, utente_id) VALUES (?, ?)");
    $stmt->bind_param("ii", $idSegnalazione, $userId);
    $stmt->execute();

    // Conta i like aggiornati
    $stmt = $conn->prepare("SELECT COUNT(*) FROM interazioni WHERE segnalazione_id = ?");
    $stmt->bind_param("i", $idSegnalazione);
    $stmt->execute();
    $stmt->bind_result($count);
    $stmt->fetch();

    echo json_encode(['action' => 'added', 'interazioni' => $count]);
}
