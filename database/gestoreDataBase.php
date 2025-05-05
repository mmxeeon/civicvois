
<?php
include 'conn.php';

function getUserByUsername($username) {
    global $conn;
    $stmt = $conn->prepare("SELECT * FROM utenti WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc();
}
?>
