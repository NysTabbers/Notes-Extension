window.addEventListener('DOMContentLoaded', () => {
    const grantBtn = document.getElementById('grantBtn');
    const status = document.getElementById('status');

    grantBtn.addEventListener('click', () => {
        grantBtn.disabled = true;
        grantBtn.textContent = 'Requesting...';
        status.textContent = '';
        status.className = '';

        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            // Stop the stream immediately — we only needed it to trigger the permission prompt
            stream.getTracks().forEach(track => track.stop());
            status.textContent = 'Permission granted! You can close this tab and use voice notes in the popup.';
            status.className = 'success';
            grantBtn.textContent = 'Done';

            // Auto close after 2 seconds
            setTimeout(() => window.close(), 2000);
        }).catch(err => {
            status.textContent = 'Permission denied. Please allow microphone access and try again.';
            status.className = 'error';
            grantBtn.disabled = false;
            grantBtn.textContent = 'Try Again';
        });
    });
});
