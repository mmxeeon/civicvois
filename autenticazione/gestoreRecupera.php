<?php
include '../database/conn.php';
$email = $_POST['email'];
// Verifica esistenza email
$stmt = $conn->prepare("SELECT id FROM utenti WHERE email=?");
$stmt->bind_param("s", $email);
$stmt->execute();
$res = $stmt->get_result();
if ($res->num_rows === 1) {
    $token = bin2hex(random_bytes(16));
    $stmt2 = $conn->prepare("UPDATE utenti SET resetToken=?, tokenExpiry=DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE email=?");
    $stmt2->bind_param("ss", $token, $email);
    $stmt2->execute();
    $link = "http://localhost/.../autenticazione/nuovaPassword.php?token=$token";
    mail($email, "Recupero Password Civicvois", "Clicca qui per reimpostare la password: $link");
    echo "<script>alert('Controlla la tua email');window.location.href='paginaLogin.php';</script>";
} else {
    echo "<script>alert('Email non trovata');window.location.href='recuperaPassword.php';</script>";
}
