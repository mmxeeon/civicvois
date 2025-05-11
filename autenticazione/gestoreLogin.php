<?php
session_start();
include '../database/conn.php';

$login = $_POST['login'];
$pass = md5($_POST['password']);

$sql = "SELECT id, username, email FROM utenti WHERE (username=? OR email=?) AND passwd=?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("sss", $login, $login, $pass);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 1) {
    $row = $result->fetch_assoc();
    // Memorizza ID utente e username in sessione
    $_SESSION['userId'] = $row['id'];
    $_SESSION['username'] = $row['username'];
    header("Location: ../pagine/home.php");
    exit();
} else {
    echo "<script>alert('Credenziali non valide');window.location.href='paginaLogin.php';</script>";
}
