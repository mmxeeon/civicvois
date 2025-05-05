
<?php
session_start();
session_destroy();
header("Location: paginaLogin.php");
exit();
?>