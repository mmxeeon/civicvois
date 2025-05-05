<?php session_start();
include '../database/conn.php';
$token = $_GET['token'] ?? '';
$stmt = $conn->prepare("SELECT id FROM utenti WHERE resetToken=? AND tokenExpiry>NOW()");
$stmt->bind_param("s", $token);
$stmt->execute();
$res = $stmt->get_result();
if ($res->num_rows !== 1) exit('Link non valido');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $new = md5($_POST['password']);
    $id = $res->fetch_assoc()['id'];
    $stmt2 = $conn->prepare("UPDATE utenti SET passwd=?, resetToken=NULL, tokenExpiry=NULL WHERE id=?");
    $stmt2->bind_param("si", $new, $id);
    $stmt2->execute();
    echo 'Password aggiornata. <a href="paginaLogin.php">Accedi</a>';
    exit;
}
?>
<html lang="it">

<head>
    <meta charset="UTF-8">
    <title>Nuova Password</title>
    <link rel="stylesheet" href="../assets/css/style.css">
</head>

<body>
    <div class="container auth-container">
        <h2>Nuova Password</h2>
        <form method="post"><input type="password" name="password" placeholder="Nuova password" required><button type="submit">Salva</button></form>
    </div>
</body>

</html>