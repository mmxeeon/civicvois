<?php
// header.php
session_start();
// Se ti serve la foto profilo, recuperala prima in sessione o nel file che include questo header
$avatar = $_SESSION['fotoProfilo'] ?? 'default.png';
?>
<header>
  <div class="header-left">
    <a href="/"><img src="/assets/img/civicvoisLogo.png" alt="Logo Civicvois" class="avatar logo"></a>
    <h1>Civicvois</h1>
  </div>
  <div class="profile-container">
    <a href="profilo.php">
      <img src="/assets/img/<?= htmlspecialchars($avatar) ?>" alt="Avatar Utente" class="avatar">
    </a>
    <a href="../autenticazione/paginaLogout.php" class="logout">Logout</a>
  </div>
</header>
