<?php
session_start();

if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
require_once '../database/conn.php';

// Ottieni ID utente
$stmt = $conn->prepare("SELECT id FROM utenti WHERE username = ?");
$stmt->bind_param("s", $_SESSION['username']);
$stmt->execute();
$stmt->bind_result($userId);
$stmt->fetch();
$stmt->close();
if (!$userId) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}

// Verifica POST
if (!isset($_POST['id']) || empty($_POST['id'])) {
    $_SESSION['error'] = "ID segnalazione non valido.";
    header("Location: ../pagine/editSegnalazione.php");
    exit();
}
$idSegnalazione = intval($_POST['id']);

// Acquisisci campi
$tipo        = trim($_POST['tipo']);
$descrizione = trim($_POST['descrizione']);
$via         = trim($_POST['via']);
$civico      = intval($_POST['civico']);
$regione     = intval($_POST['regione']);
$provincia   = intval($_POST['provincia']);
$comune      = trim($_POST['comune']);
$foto        = null;

// Validazione
if (empty($tipo)||empty($descrizione)||empty($via)||$civico<=0||!$regione||!$provincia||empty($comune)){
    $_SESSION['error'] = "Tutti i campi devono essere compilati.";
    header("Location: ../pagine/editSegnalazione.php?id={$idSegnalazione}");
    exit();
}

// Gestione upload foto
if (!empty($_FILES['foto']['name'])) {
    $dir     = "../assets/img/";
    $file    = uniqid() . '_' . basename($_FILES['foto']['name']);
    $tmp     = $_FILES['foto']['tmp_name'];
    $path    = $dir . $file;
    $ext     = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $allow   = ['jpg','jpeg','png','gif'];
    if(!in_array($ext,$allow)){
        $_SESSION['error']="Formato file non valido.";
        header("Location: ../pagine/editSegnalazione.php?id={$idSegnalazione}"); exit();
    }
    if(move_uploaded_file($tmp,$path)){
        $foto = "/assets/img/{$file}";
    } else {
        $_SESSION['error']="Errore nel caricamento foto.";
        header("Location: ../pagine/editSegnalazione.php?id={$idSegnalazione}"); exit();
    }
} else {
    // Mantieni esistente
    $stmt = $conn->prepare("SELECT foto FROM segnalazioni WHERE id=? AND idUtente=?");
    $stmt->bind_param("ii",$idSegnalazione,$userId);
    $stmt->execute();
    $stmt->bind_result($foto);
    $stmt->fetch();
    $stmt->close();
}

// Esegui update
$stmt = $conn->prepare(
    "UPDATE segnalazioni SET tipo=?,descrizione=?,via=?,civico=?,foto=?,regione=?,provincia=?,comune=? WHERE id=? AND idUtente=?"
);
$stmt->bind_param("sssisiisii", $tipo, $descrizione, $via, $civico, $foto, $regione, $provincia, $comune, $idSegnalazione, $userId);

if($stmt->execute()){
    $_SESSION['success'] = "Segnalazione aggiornata.";
    header("Location: ../pagine/home.php");
    exit();
} else {
    error_log("SQL Error: " . $stmt->error);
    $_SESSION['error'] = "Errore aggiornamento.";
    header("Location: ../pagine/editSegnalazione.php?id={$idSegnalazione}");
    exit();
}
?>