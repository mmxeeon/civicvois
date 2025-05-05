<?php
session_start();
if (!isset($_SESSION['username'])) {
    header("Location: ../autenticazione/paginaLogin.php");
    exit();
}
require_once '../database/conn.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$conn->set_charset('utf8');

// Fetch filter options
$tipi = $conn->query("SELECT DISTINCT tipo FROM segnalazioni ORDER BY tipo ASC")->fetch_all(MYSQLI_ASSOC);
$regioni = $conn->query("SELECT id, nome FROM regioni ORDER BY nome ASC")->fetch_all(MYSQLI_ASSOC);

// Read filters
$selTipo = $_GET['tipo'] ?? '';
$selRegione = $_GET['regione'] ?? '';
$selProvincia = $_GET['provincia'] ?? '';
$selComuneText = $_GET['comune'] ?? '';
$selVia = $_GET['via'] ?? '';
$selData = $_GET['data'] ?? '';

// Build dynamic filters
$conds = [];
$params = [];
$types = '';
if ($selTipo)      { $conds[] = 'seg.tipo = ?';              $params[] = $selTipo;        $types .= 's'; }
if ($selRegione)   { $conds[] = 'seg.regione = ?';            $params[] = (int)$selRegione; $types .= 'i'; }
if ($selProvincia) { $conds[] = 'seg.provincia = ?';           $params[] = (int)$selProvincia; $types .= 'i'; }
if ($selComuneText){ $conds[] = 'seg.comune LIKE ?';          $params[] = "%{$selComuneText}%"; $types .= 's'; }
if ($selVia)       { $conds[] = 'seg.via LIKE ?';            $params[] = "%{$selVia}%";      $types .= 's'; }
if ($selData)      { $conds[] = 'DATE(seg.dataSegnalazione) = ?'; $params[] = $selData;        $types .= 's'; }

// Main query with interaction count and liked flag
$userId = $_SESSION['userId'];
$sql = "SELECT
    seg.id,
    seg.tipo,
    seg.descrizione,
    seg.via,
    seg.civico,
    r.nome AS regione,
    p.nome AS provincia,
    seg.comune,
    COUNT(i.segnalazione_id) AS interazioni,
    IF(ui.segnalazione_id IS NULL, 0, 1) AS liked,
    seg.dataSegnalazione
  FROM segnalazioni seg
  LEFT JOIN regioni r ON seg.regione = r.id
  LEFT JOIN province p ON seg.provincia = p.id
  LEFT JOIN interazioni i ON seg.id = i.segnalazione_id
  LEFT JOIN interazioni ui ON seg.id = ui.segnalazione_id AND ui.utente_id = ?";
$params = array_merge([$userId], $params);
$types = 'i' . $types;
if ($conds) {
    $sql .= ' WHERE ' . implode(' AND ', $conds);
}
$sql .= ' GROUP BY seg.id ORDER BY interazioni DESC, seg.dataSegnalazione DESC';
$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$segn = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Home - Civicvois</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            background: #e6f7ff;
            color: #000;
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 20px;
            background: #007acc;
            color: #fff;
        }
        header h1 {
            margin: 0;
            font-size: 1.5rem;
        }
        .welcome {
            margin-right: 15px;
            font-size: 1rem;
        }
        a.logout {
            color: #fff;
            text-decoration: none;
            background: #005f99;
            padding: 8px 12px;
            border-radius: 4px;
            transition: background .3s;
        }
        a.logout:hover {
            background: #004080;
        }
        .container {
            flex: 1;
            padding: 20px;
        }
        .filters {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }
        .filters select,
        .filters input,
        .filters button {
            padding: 8px;
            border: 1px solid #007acc;
            border-radius: 4px;
            font-size: 0.9rem;
        }
        .filters select:disabled,
        .filters input:disabled {
            background: #ddd;
        }
        .filters button {
            background: #007acc;
            color: #fff;
            cursor: pointer;
            transition: background .3s;
        }
        .filters button:hover {
            background: #005f99;
        }
        .segnalazioni-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
            padding-bottom: 20px;
        }
        .card {
            background: #fff;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            position: relative;
        }
        .card img {
            width: 100%;
            height: auto;
            border-radius: 5px;
            margin-bottom: 10px;
        }
        .interactions-btn {
            position: absolute;
            bottom: 15px;
            right: 15px;
            background: transparent;
            border: none;
            font-size: 1.2rem;
            cursor: pointer;
            color: #007acc;
        }
        .interactions-btn.liked {
            color: #e0245e;
            cursor: default;
        }
        footer {
            margin-top: auto;
            padding: 10px 0;
            background: #007acc;
            display: flex;
            justify-content: center;
            gap: 20px;
        }
        footer a {
            color: #fff;
            text-decoration: none;
            padding: 8px 12px;
            background: #005f99;
            border-radius: 4px;
            transition: background .3s;
        }
        footer a:hover {
            background: #004080;
        }
    </style>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
</head>
<body>
<header>
    <h1>Civicvois</h1>
    <div>
        <span class="welcome"><?= htmlspecialchars($_SESSION['username']) ?></span>
        <a href="../autenticazione/paginaLogout.php" class="logout">Logout</a>
    </div>
</header>
<div class="container">
    <form class="filters" method="get">
        <select name="tipo">
            <option value="">Tutti i tipi</option>
            <?php foreach ($tipi as $t): ?>
                <option value="<?= htmlspecialchars($t) ?>" <?= $t === $selTipo ? 'selected' : '' ?>><?= htmlspecialchars($t) ?></option>
            <?php endforeach; ?>
        </select>
        <select name="regione" id="regione">
            <option value="">Tutte le regioni</option>
            <?php foreach ($regioni as $r): ?>
                <option value="<?= $r['id'] ?>" <?= $r['id'] == $selRegione ? 'selected' : '' ?>><?= htmlspecialchars($r['nome']) ?></option>
            <?php endforeach; ?>
        </select>
        <select name="provincia" id="provincia" <?= $selRegione ? '' : 'disabled' ?> >
            <option value="">Tutte le province</option>
        </select>
        <input type="text" name="comune" placeholder="Comune" value="<?= htmlspecialchars($selComuneText) ?>" <?= $selProvincia ? '' : 'disabled' ?> />
        <input type="text" name="via" placeholder="Via" value="<?= htmlspecialchars($selVia) ?>" <?= $selComuneText ? '' : 'disabled' ?> />
        <input type="date" name="data" value="<?= htmlspecialchars($selData) ?>" />
        <button type="submit">Filtra</button>
    </form>
    <div class="segnalazioni-grid">
        <?php if (count($segn) > 0): foreach ($segn as $s): ?>
            <div class="card" data-id="<?= $s['id'] ?>">
                <?php if (!empty($s['foto'])): ?>
                    <img src="../<?= htmlspecialchars($s['foto']) ?>" alt="Segnalazione">
                <?php endif; ?>
                <h3><?= htmlspecialchars($s['tipo']) ?></h3>
                <p><?= nl2br(htmlspecialchars($s['descrizione'])) ?></p>
                <?php if (!empty($s['regione'])): ?><p><strong>Regione:</strong> <?= htmlspecialchars($s['regione']) ?></p><?php endif; ?>
                <?php if (!empty($s['provincia'])): ?><p><strong>Provincia:</strong> <?= htmlspecialchars($s['provincia']) ?></p><?php endif; ?>
                <?php if (!empty($s['comune'])): ?><p><strong>Comune:</strong> <?= htmlspecialchars($s['comune']) ?></p><?php endif; ?>
                <?php if (!empty($s['via']) || !empty($s['civico'])): ?><p><strong>Indirizzo:</strong> <?= htmlspecialchars($s['via']) ?> <?= htmlspecialchars($s['civico']) ?></p><?php endif; ?>
                <p><strong>Data:</strong> <?= (new DateTime($s['dataSegnalazione']))->format('d/m/Y') ?></p>
                <button class="interactions-btn <?= $s['liked'] ? 'liked' : '' ?>" <?= $s['liked'] ? 'disabled' : '' ?>>❤️ <span><?= $s['interazioni'] ?></span></button>
            </div>
        <?php endforeach; else: ?>
            <p>Nessuna segnalazione disponibile.</p>
        <?php endif; ?>
    </div>
</div>
<script>
    const debounce = (fn, delay = 500) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; };
    $(function(){
        $('#regione').change(function(){
            let r = $(this).val();
            $('#provincia').prop('disabled', !r).html('<option value="">Tutte le province</option>');
            if(r) {
                $.getJSON('../ajax/getProvince.php',{regione:r},pl=>pl.forEach(p=>$('#provincia').append(new Option(p.nome,p.id))));
            }
            $('[name=comune],[name=via]').prop('disabled', true).val('');
        });
        $('#provincia').change(function(){ $('[name=comune]').prop('disabled', !$(this).val()).val(''); });
        $('[name=comune]').on('input', function(){ $('[name=via]').prop('disabled', !$(this).val()).val(''); });
        $('.interactions-btn').click(debounce(function(){
            const b = $(this), id = b.closest('.card').data('id');
            if(b.prop('disabled')) return;
            $.post('../api/incrementaInterazioni.php',{id},res=>{
                if(res.success) { b.find('span').text(res.interazioni); b.addClass('liked').prop('disabled', true); }
                else alert(res.message||'Errore');
            },'json');
        },500));
    });
</script>
<footer>
    <a href="home.php">Home</a>
    <a href="createSegnalazione.php">Nuova Segnalazione</a>
    <a href="profilo.php">Profilo</a>
</footer>
</body>
</html>