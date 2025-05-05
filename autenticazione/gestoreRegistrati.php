<?php
include '../database/conn.php';
$nome = $_POST['nome'];
$cognome = $_POST['cognome'];
$email = $_POST['email'];
$data = $_POST['dataDiNascita'];
$username = $_POST['username'];
$password = md5($_POST['password']);
$bio = $_POST['bio'];
// Upload foto profilo
$fotoDest = '';
if (!empty($_FILES['fotoProfilo']['name'])) {
    $destDir = '../assets/img/';
    $fotoDest = $destDir . basename($_FILES['fotoProfilo']['name']);
    move_uploaded_file($_FILES['fotoProfilo']['tmp_name'], $fotoDest);
}
$sql = "INSERT INTO utenti (nome,cognome,email,dataDiNascita,fotoProfilo,username,passwd,bio) VALUES (?,?,?,?,?,?,?,?)";
$stmt = $conn->prepare($sql);
$stmt->bind_param("ssssssss", $nome, $cognome, $email, $data, $fotoDest, $username, $password, $bio);
if ($stmt->execute()) {
    header("Location: paginaLogin.php");
} else {
    echo "Errore: " . $conn->error;
}
