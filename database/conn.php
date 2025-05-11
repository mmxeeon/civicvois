<?php
$host = 'localhost';
$user = 'root';
$pass = '';
$dbname = 'civicvois';

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    die("Connessione fallita: " . $conn->connect_error);
}
