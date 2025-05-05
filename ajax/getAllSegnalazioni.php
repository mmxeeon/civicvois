<?php
include '../database/conn.php';
$result = $conn->query("SELECT s.*, u.username FROM segnalazioni s JOIN utenti u ON s.idUtente = u.id ORDER BY dataSegnalazione DESC");
$segnalazioni = [];
while ($row = $result->fetch_assoc()) {
    $segnalazioni[] = $row;
}
echo json_encode($segnalazioni);
