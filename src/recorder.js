// recorder.js — Microphone permission helper page
//
// This page exists as a fallback for when getUserMedia fails in the popup
// (e.g. first-time mic request). It opens as a full browser tab, asks the
// user to grant permission, then closes itself automatically.
// Once the user grants with "Remember this decision" checked, this tab
// will never need to open again.

window.addEventListener('DOMContentLoaded', () => {
    const grantBtn = document.getElementById('grantBtn');
    const status = document.getElementById('status');

    grantBtn.addEventListener('click', () => {
        // Disable the button and show a loading state while the browser
        // permission prompt is open so the user can't click it twice
        grantBtn.disabled = true;
        grantBtn.textContent = 'Requesting...';
        status.textContent = '';
        status.className = '';

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            // Stop the stream tracks immediately — we only needed getUserMedia
            // to trigger the browser's permission prompt, not to actually record
            stream.getTracks().forEach(track => track.stop());

            status.textContent = 'Permission granted! You can close this tab and use voice notes in the popup.';
            status.className = 'success';
            grantBtn.textContent = 'Done';

            // Auto-close after 2 seconds so the user doesn't have to manually close it
            setTimeout(() => window.close(), 2000);
        }).catch(err => {
            // User denied the prompt or no microphone is available
            status.textContent = 'Permission denied. Please allow microphone access and try again.';
            status.className = 'error';
            grantBtn.disabled = false;
            grantBtn.textContent = 'Try Again';
        });
    });
});
