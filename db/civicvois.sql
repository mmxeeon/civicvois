-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Creato il: Apr 26, 2025 alle 16:21
-- Versione del server: 10.4.32-MariaDB
-- Versione PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `civicvois`
--

-- --------------------------------------------------------

--
-- Struttura della tabella `comuni`
--

CREATE TABLE `comuni` (
  `id` int(11) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `provincia_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struttura della tabella `province`
--

CREATE TABLE `province` (
  `id` int(11) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `regione_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dump dei dati per la tabella `province`
--

INSERT INTO `province` (`id`, `nome`, `regione_id`) VALUES
(1, 'Chieti', 1),
(2, 'L\'Aquila', 1),
(3, 'Pescara', 1),
(4, 'Teramo', 1),
(5, 'Matera', 2),
(6, 'Potenza', 2),
(7, 'Catanzaro', 3),
(8, 'Cosenza', 3),
(9, 'Crotone', 3),
(10, 'Reggio Calabria', 3),
(11, 'Vibo Valentia', 3),
(12, 'Avellino', 4),
(13, 'Benevento', 4),
(14, 'Caserta', 4),
(15, 'Napoli', 4),
(16, 'Salerno', 4),
(17, 'Bologna', 5),
(18, 'Ferrara', 5),
(19, 'Forlì-Cesena', 5),
(20, 'Modena', 5),
(21, 'Parma', 5),
(22, 'Piacenza', 5),
(23, 'Ravenna', 5),
(24, 'Reggio Emilia', 5),
(25, 'Rimini', 5),
(26, 'Gorizia', 6),
(27, 'Pordenone', 6),
(28, 'Trieste', 6),
(29, 'Udine', 6),
(30, 'Frosinone', 7),
(31, 'Latina', 7),
(32, 'Rieti', 7),
(33, 'Roma', 7),
(34, 'Viterbo', 7),
(35, 'Genova', 8),
(36, 'Imperia', 8),
(37, 'La Spezia', 8),
(38, 'Savona', 8),
(39, 'Bergamo', 9),
(40, 'Brescia', 9),
(41, 'Como', 9),
(42, 'Cremona', 9),
(43, 'Lecco', 9),
(44, 'Lodi', 9),
(45, 'Mantova', 9),
(46, 'Milano', 9),
(47, 'Monza e Brianza', 9),
(48, 'Pavia', 9),
(49, 'Sondrio', 9),
(50, 'Varese', 9),
(51, 'Ancona', 10),
(52, 'Ascoli Piceno', 10),
(53, 'Fermo', 10),
(54, 'Macerata', 10),
(55, 'Pesaro e Urbino', 10),
(56, 'Campobasso', 11),
(57, 'Isernia', 11),
(58, 'Alessandria', 12),
(59, 'Asti', 12),
(60, 'Biella', 12),
(61, 'Cuneo', 12),
(62, 'Novara', 12),
(63, 'Torino', 12),
(64, 'Verbano-Cusio-Ossola', 12),
(65, 'Vercelli', 12),
(66, 'Bari', 13),
(67, 'Barletta-Andria-Trani', 13),
(68, 'Brindisi', 13),
(69, 'Foggia', 13),
(70, 'Lecce', 13),
(71, 'Taranto', 13),
(72, 'Cagliari', 14),
(73, 'Carbonia-Iglesias', 14),
(74, 'Medio Campidano', 14),
(75, 'Nuoro', 14),
(76, 'Oristano', 14),
(77, 'Sassari', 14),
(78, 'Agrigento', 15),
(79, 'Caltanissetta', 15),
(80, 'Catania', 15),
(81, 'Enna', 15),
(82, 'Messina', 15),
(83, 'Palermo', 15),
(84, 'Ragusa', 15),
(85, 'Siracusa', 15),
(86, 'Trapani', 15),
(87, 'Arezzo', 16),
(88, 'Firenze', 16),
(89, 'Grosseto', 16),
(90, 'Livorno', 16),
(91, 'Lucca', 16),
(92, 'Massa-Carrara', 16),
(93, 'Pisa', 16),
(94, 'Pistoia', 16),
(95, 'Prato', 16),
(96, 'Siena', 16),
(97, 'Bolzano', 17),
(98, 'Trento', 17),
(99, 'Perugia', 18),
(100, 'Terni', 18),
(101, 'Aosta', 19),
(102, 'Belluno', 20),
(103, 'Padova', 20),
(104, 'Rovigo', 20),
(105, 'Treviso', 20),
(106, 'Venezia', 20),
(107, 'Verona', 20),
(108, 'Vicenza', 20);

-- --------------------------------------------------------

--
-- Struttura della tabella `regioni`
--

CREATE TABLE `regioni` (
  `id` int(11) NOT NULL,
  `nome` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dump dei dati per la tabella `regioni`
--

INSERT INTO `regioni` (`id`, `nome`) VALUES
(1, 'Abruzzo'),
(2, 'Basilicata'),
(3, 'Calabria'),
(4, 'Campania'),
(5, 'Emilia-Romagna'),
(6, 'Friuli-Venezia Giulia'),
(7, 'Lazio'),
(8, 'Liguria'),
(9, 'Lombardia'),
(10, 'Marche'),
(11, 'Molise'),
(12, 'Piemonte'),
(13, 'Puglia'),
(14, 'Sardegna'),
(15, 'Sicilia'),
(16, 'Toscana'),
(17, 'Trentino-Alto Adige'),
(18, 'Umbria'),
(19, 'Valle d\'Aosta'),
(20, 'Veneto');

-- --------------------------------------------------------

--
-- Struttura della tabella `segnalazioni`
--

CREATE TABLE `segnalazioni` (
  `id` int(11) NOT NULL,
  `idUtente` int(11) DEFAULT NULL,
  `tipo` enum('cartello stradale: mancante','cartello stradale: caduto','cartello stradale: vandalizzato','cartello stradale: girato','cartello stradale: non riflettente','strada: rotta','strada: piena di buchi','strada: invalicabile per via di ostacoli','strada: franata','animali: smarriti','animali: morti','animali: ritrovati','infrastrutture pubbliche: ponti','infrastrutture pubbliche: cavalcavia','infrastrutture pubbliche: sottopassaggi (possibile allagamenti)','infrastrutture pubbliche: rotonde con prato (lasciato incolto)','infrastrutture pubbliche: spartitraffico o isole di traffico con prato incurato','privati: cartelli appesi fuori da abitazioni private (passi carrabili)','privati: tutto ciò che è proveniente da abitazioni private che potrebbe ostacolare o portare problemi allo stato urbano') NOT NULL,
  `descrizione` text DEFAULT NULL,
  `foto` varchar(255) DEFAULT NULL,
  `comune` varchar(50) NOT NULL,
  `via` varchar(255) DEFAULT NULL,
  `civico` varchar(4) NOT NULL,
  `dataSegnalazione` datetime DEFAULT current_timestamp(),
  `regione` varchar(255) NOT NULL,
  `provincia` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dump dei dati per la tabella `segnalazioni`
--

INSERT INTO `segnalazioni` (`id`, `idUtente`, `tipo`, `descrizione`, `foto`, `comune`, `via`, `civico`, `dataSegnalazione`, `regione`, `provincia`) VALUES
(1, 1, '', 'strada rotta', '', '', 'via roma ', '', '2025-04-16 14:18:06', '', ''),
(2, 1, 'cartello stradale: vandalizzato', 'CARTELLO STOP RICOPERTO DI ADESIVO', '', '', 'via roma', '56', '2025-04-16 14:19:10', '', ''),
(3, 2, 'cartello stradale: vandalizzato', NULL, '', 'verano brianza', 'san giuseppe', '63', '2025-04-25 15:09:03', '9', '47'),
(4, 2, 'animali: ritrovati', NULL, '', 'Milano', 'via roma', '95', '2025-04-25 15:14:43', '9', '46'),
(5, 2, 'cartello stradale: vandalizzato', 'gfwsdfsafdsadfsafdsadf', '', 'Milano', 'via roma', '78', '2025-04-25 15:28:21', '9', '46'),
(6, 2, 'strada: invalicabile per via di ostacoli', NULL, '', 'Aosta', 'via roma', '56', '2025-04-25 16:23:53', '19', '101'),
(7, 2, 'infrastrutture pubbliche: cavalcavia', NULL, '', 'Milano', 'via roma', '45', '2025-04-25 16:26:23', '9', '46'),
(8, 2, 'infrastrutture pubbliche: rotonde con prato (lasciato incolto)', NULL, '', 'verano brianza', 'via matera', '23', '2025-04-25 16:26:45', '9', '44'),
(9, 2, 'infrastrutture pubbliche: cavalcavia', NULL, '', '123rwefrf', 'sdfqsdfas', '123', '2025-04-25 16:27:01', '5', '21'),
(10, 2, 'privati: tutto ciò che è proveniente da abitazioni private che potrebbe ostacolare o portare problemi allo stato urbano', NULL, '', 'verano brianza', 'asdfasf', '123', '2025-04-25 16:27:18', '4', '16'),
(11, 2, 'cartello stradale: mancante', 'stop', '', 'Milano', 'via roma', '78', '2025-04-25 16:54:27', '9', '46'),
(12, 2, 'strada: rotta', 'piena di buchi', '', 'Verano Brianza', 'via roma', '56', '2025-04-26 14:38:37', '9', '47');

-- --------------------------------------------------------

--
-- Struttura della tabella `utenti`
--

CREATE TABLE `utenti` (
  `id` int(11) NOT NULL,
  `nome` varchar(50) DEFAULT NULL,
  `cognome` varchar(50) DEFAULT NULL,
  `email` varchar(50) NOT NULL,
  `dataDiNascita` date DEFAULT NULL,
  `fotoProfilo` varchar(255) DEFAULT NULL,
  `username` varchar(50) DEFAULT NULL,
  `passwd` varchar(255) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `tipo` enum('admin','user') DEFAULT 'user',
  `resetToken` varchar(255) DEFAULT NULL,
  `tokenExpiry` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dump dei dati per la tabella `utenti`
--

INSERT INTO `utenti` (`id`, `nome`, `cognome`, `email`, `dataDiNascita`, `fotoProfilo`, `username`, `passwd`, `bio`, `tipo`, `resetToken`, `tokenExpiry`) VALUES
(1, 'mattia', 'molteni', 'matti.molte@gmail.com', '2006-11-29', '../assets/img/', 'mattia', 'dbc3ede8cf726a5f892a7808f647aa3e', 'mattia', 'user', NULL, NULL),
(2, 'Nicolò', 'Molteni', 'matti.molte@gmail.com', '2006-11-29', '../assets/img/profile_picture.jpg', 'mattia_molteni', 'dbc3ede8cf726a5f892a7808f647aa3e', 'mattia', 'user', '61c4e9f693ea3ec1afe698b6959ea5dc', '2025-04-26 15:49:38');

--
-- Indici per le tabelle scaricate
--

--
-- Indici per le tabelle `comuni`
--
ALTER TABLE `comuni`
  ADD PRIMARY KEY (`id`),
  ADD KEY `provincia_id` (`provincia_id`);

--
-- Indici per le tabelle `province`
--
ALTER TABLE `province`
  ADD PRIMARY KEY (`id`),
  ADD KEY `regione_id` (`regione_id`);

--
-- Indici per le tabelle `regioni`
--
ALTER TABLE `regioni`
  ADD PRIMARY KEY (`id`);

--
-- Indici per le tabelle `segnalazioni`
--
ALTER TABLE `segnalazioni`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idUtente` (`idUtente`);

--
-- Indici per le tabelle `utenti`
--
ALTER TABLE `utenti`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT per le tabelle scaricate
--

--
-- AUTO_INCREMENT per la tabella `comuni`
--
ALTER TABLE `comuni`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT per la tabella `province`
--
ALTER TABLE `province`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=109;

--
-- AUTO_INCREMENT per la tabella `regioni`
--
ALTER TABLE `regioni`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT per la tabella `segnalazioni`
--
ALTER TABLE `segnalazioni`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT per la tabella `utenti`
--
ALTER TABLE `utenti`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Limiti per le tabelle scaricate
--

--
-- Limiti per la tabella `comuni`
--
ALTER TABLE `comuni`
  ADD CONSTRAINT `comuni_ibfk_1` FOREIGN KEY (`provincia_id`) REFERENCES `province` (`id`);

--
-- Limiti per la tabella `province`
--
ALTER TABLE `province`
  ADD CONSTRAINT `province_ibfk_1` FOREIGN KEY (`regione_id`) REFERENCES `regioni` (`id`);

--
-- Limiti per la tabella `segnalazioni`
--
ALTER TABLE `segnalazioni`
  ADD CONSTRAINT `segnalazioni_ibfk_1` FOREIGN KEY (`idUtente`) REFERENCES `utenti` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
