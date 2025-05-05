<?php
include '../database/conn.php';

$regione_id = $_GET['regione_id'];
$stmt = $conn->prepare("SELECT id, nome FROM province WHERE regione_id = ? ORDER BY nome ASC");
$stmt->bind_param("i", $regione_id);
$stmt->execute();
$result = $stmt->get_result();
echo json_encode($result->fetch_all(MYSQLI_ASSOC));
?>