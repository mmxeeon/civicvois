<?php
$host = 'localhost';
$user = 'sticnbkk_wp292';
$pass = '}-]A$yXun;T]';
$dbname = 'sticnbkk_wp292';

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    die("Connessione fallita: " . $conn->connect_error);
}
?>