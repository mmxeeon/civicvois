document.addEventListener('DOMContentLoaded', () => {
    fetch('../ajax/getAllSegnalazioni.php')
        .then(res => res.json())
        .then(data => {
            const div = document.getElementById('segnalazioni');
            data.forEach(seg => {
                const el = document.createElement('div');
                el.innerHTML = `<h3>${seg.tipoProblema}</h3><p>${seg.descrizione}</p><small>${seg.indirizzo}</small>`;
                div.appendChild(el);
            });
        });
});