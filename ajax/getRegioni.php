<?php
include '../database/conn.php';

$result = $conn->query("SELECT id, nome FROM regioni ORDER BY nome ASC");
echo json_encode($result->fetch_all(MYSQLI_ASSOC));
?>