<?php
session_start();
require_once '../database/conn.php';

header('Content-Type: application/json');

// Verifica autenticazione
if (!isset($_SESSION['userId'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Non autenticato']);
    exit;
}

$id = intval($_POST['id'] ?? 0);
$utenteId = $_SESSION['userId'];

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'ID non valido']);
    exit;
}

// Inserisci interazione se non già esistente
$ins = $conn->prepare("INSERT IGNORE INTO interazioni (utente_id, segnalazione_id) VALUES (?, ?)");
$ins->bind_param('ii', $utenteId, $id);
$ins->execute();

// Recupera conteggio aggiornato
$countStmt = $conn->prepare("SELECT COUNT(*) FROM interazioni WHERE segnalazione_id = ?");
$countStmt->bind_param('i', $id);
$countStmt->execute();
$countStmt->bind_result($tot);
$countStmt->fetch();

echo json_encode([
    'success' => true,
    'interazioni' => $tot
]);
?>
