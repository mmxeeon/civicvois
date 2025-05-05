<?php
include '../database/conn.php';

$provincia_id = $_GET['provincia_id'];
$stmt = $conn->prepare("SELECT id, nome FROM comuni WHERE provincia_id = ? ORDER BY nome ASC");
$stmt->bind_param("i", $provincia_id);
$stmt->execute();
$result = $stmt->get_result();
echo json_encode($result->fetch_all(MYSQLI_ASSOC));
?>