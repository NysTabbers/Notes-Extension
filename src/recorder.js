// recorder.js — Microfoontoestemmingshelperpagina
//
// Deze pagina bestaat als terugvaloptie wanneer getUserMedia mislukt in de popup
// (bijv. eerste microfoonverzoek). Ze opent als een volledig browsertabblad, vraagt de
// gebruiker om toestemming te verlenen en sluit zichzelf daarna automatisch.
// Zodra de gebruiker toestemming verleent met "Onthoud deze beslissing" aangevinkt,
// hoeft dit tabblad nooit meer te openen.

window.addEventListener('DOMContentLoaded', () => {
    const grantBtn = document.getElementById('grantBtn');
    const status = document.getElementById('status');

    grantBtn.addEventListener('click', () => {
        // Schakel de knop uit en toon een laadstatus terwijl de browser-
        // toestemmingsprompt open is, zodat de gebruiker er niet twee keer op kan klikken
        grantBtn.disabled = true;
        grantBtn.textContent = 'Requesting...';
        status.textContent = '';
        status.className = '';

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            // Stop de streamtracks onmiddellijk — we hadden getUserMedia alleen nodig
            // om de toestemmingsprompt van de browser te activeren, niet om daadwerkelijk op te nemen
            stream.getTracks().forEach(track => track.stop());

            status.textContent = 'Permission granted! You can close this tab and use voice notes in the popup.';
            status.className = 'success';
            grantBtn.textContent = 'Done';

            // Automatisch sluiten na 2 seconden zodat de gebruiker het niet handmatig hoeft te sluiten
            setTimeout(() => window.close(), 2000);
        }).catch(err => {
            // Gebruiker heeft de prompt geweigerd of er is geen microfoon beschikbaar
            status.textContent = 'Permission denied. Please allow microphone access and try again.';
            status.className = 'error';
            grantBtn.disabled = false;
            grantBtn.textContent = 'Try Again';
        });
    });
});
