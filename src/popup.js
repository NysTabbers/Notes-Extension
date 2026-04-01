// Compatibiliteitsshim voor cross-browser API.
// Firefox biedt de WebExtensions API aan als `browser`, Chrome gebruikt `chrome`.
// Met deze variabele werkt de rest van de code in beide browsers zonder vertakkingen.
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// --------------------------------------------------------------------------
// Opslaghulpfuncties
// Alle notitigegevens en instellingen worden opgeslagen in chrome.storage.local
// in plaats van localStorage. localStorage kan onbetrouwbaar zijn in extensie-popups
// en wordt niet gedeeld tussen contexten. chrome.storage.local werkt correct in
// zowel Chrome als Firefox en blijft bewaard na het sluiten van de popup.
// --------------------------------------------------------------------------

// Laadt de notitiesarray uit de opslag en geeft deze door aan de callback.
// Valt terug op een lege array als er nog niets is opgeslagen of als de data corrupt is.
function loadNotes(callback) {
  browserAPI.storage.local.get("notes", (result) => {
    try {
      callback(Array.isArray(result.notes) ? result.notes : []);
    } catch (e) {
      console.error("failed to load notes", e);
      callback([]);
    }
  });
}

// Slaat de volledige notitiesarray op in de opslag.
// De optionele callback wordt aangeroepen zodra het schrijven klaar is — gebruikt om
// acties te koppelen, zoals terugnavigeren naar de startpagina na een opslag.
function saveNotes(notes, callback) {
  browserAPI.storage.local.set({ notes }, () => {
    if (callback) callback();
  });
}

// Leest de auto-link-instelling uit de opslag en geeft een boolean door aan de callback.
// Standaard ingeschakeld als de instelling nog nooit is opgeslagen.
function getAutoLinkSetting(callback) {
  browserAPI.storage.local.get("autoLink", (result) => {
    // Behandel alles behalve een expliciete `false` als ingeschakeld
    callback(result.autoLink !== false);
  });
}

// Slaat de auto-link-voorkeur (true/false) op in de opslag.
function setAutoLinkSetting(value) {
  browserAPI.storage.local.set({ autoLink: value });
}

// Vraagt de huidig actieve tab op en geeft de URL ervan terug via een callback.
// Gebruikt browserAPI zodat het werkt in zowel Chrome als Firefox.
function getCurrentTabUrl(callback) {
  browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    callback(tabs[0]?.url || "");
  });
}

// --------------------------------------------------------------------------
// Weergavebeheer
// De popup gebruikt een single-page-patroon — slechts één "view"-div is tegelijk
// zichtbaar. hideAllViews() verbergt alles voordat de gewenste weergave wordt getoond.
// --------------------------------------------------------------------------

function hideAllViews() {
  document.getElementById("home-view").classList.add("hidden");
  document.getElementById("note-detail-view").classList.add("hidden");
  document.getElementById("new-note-view").classList.add("hidden");
  document.getElementById("settings-view").classList.add("hidden");
  document.getElementById("confirm-delete").classList.add("hidden");
  document.getElementById("confirm-overlay").classList.add("hidden");
  document.getElementById("confirm-clear-all").classList.add("hidden");
  document.getElementById("edit-Note").classList.add("hidden");
  document.getElementById("voiceRecording").classList.add("hidden");
}

// --------------------------------------------------------------------------
// Kleurhulpfuncties
// --------------------------------------------------------------------------

// Maakt een hex-kleur donkerder door `amount` af te trekken van elk RGB-kanaal.
// Gebruikt om een iets donkerdere randkleur af te leiden van de achtergrondkleur van een notitie.
function darkenColor(hex, amount = 40) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// --------------------------------------------------------------------------
// Startweergave — toont alle opgeslagen notities als een raster van sticky-kaartjes
// --------------------------------------------------------------------------

function showHome() {
  hideAllViews();

  const titleEl = document.getElementById("title");
  titleEl.textContent = "My Notes";
  titleEl.style.background = "";

  document.getElementById("home-view").classList.remove("hidden");

  const content = document.getElementById("note-content");
  content.innerHTML = "";

  loadNotes((notes) => {
    if (!notes.length) {
      content.innerHTML =
        '<p>No notes yet. Click "Make New Note" to add one.</p>';
      return;
    }

    // Bouw een raster van sticky-kaartjes, één per notitie
    const notesContainer = document.createElement("div");
    notesContainer.className = "notes-container";

    notes.forEach((note, idx) => {
      const div = document.createElement("div");
      div.className = "note-sticky";
      div.textContent = note.title || "(no title)";
      // Pas de opgeslagen kleur van de notitie toe via een CSS-aangepaste eigenschap
      if (note.color) div.style.setProperty("--bg", note.color);
      // Klikken op een kaartje opent de volledige detailweergave voor die notitie
      div.addEventListener("click", () => showNoteAt(idx));
      notesContainer.appendChild(div);
    });

    content.appendChild(notesContainer);
  });
}

// --------------------------------------------------------------------------
// Notitie verwijderen
// --------------------------------------------------------------------------

// Verwijdert de notitie op `index` uit de array, slaat op en keert terug naar de startpagina.
function deleteNoteAt(index) {
  loadNotes((notes) => {
    notes.splice(index, 1);
    saveNotes(notes, showHome);
  });
}

// Toont het bevestigingsvenster voordat een verwijdering wordt uitgevoerd.
function confirmDeleteNoteAt(index) {
  const confirmDiv = document.getElementById("confirm-delete");
  confirmDiv.classList.remove("hidden");
  document.getElementById("confirm-overlay").classList.remove("hidden");

  const confirmBtn = document.getElementById("confirm-delete-btn");
  const cancelBtn = document.getElementById("cancel-delete-btn");

  // Gebruik .onclick in plaats van addEventListener zodat het opnieuw openen van het venster
  // de handler vervangt in plaats van dubbele listeners te stapelen
  confirmBtn.onclick = () => {
    deleteNoteAt(index);
  };
  cancelBtn.onclick = () => {
    confirmDiv.classList.add("hidden");
    document.getElementById("confirm-overlay").classList.add("hidden");
  };
}

// --------------------------------------------------------------------------
// Kleurenpalet-widget
// Tekent een rij kleurvlakken binnen het element met id `containerId`.
// Geeft een { getColor() }-object terug zodat de aanroeper de huidige selectie kan lezen.
// --------------------------------------------------------------------------

function setupColorPalette(
  containerId,
  colors = ["#fffa65", "#ffd3b4", "#baffc9", "#ffb3ba", "#bde0fe", "#ffffff"],
) {
  let selected = colors[0]; // Standaard de eerste kleur in de lijst
  const paletteDiv = document.getElementById(containerId);

  colors.forEach((c) => {
    const swatch = document.createElement("span");
    swatch.className = "color-picker";
    swatch.style.background = c;
    swatch.dataset.color = c;
    swatch.addEventListener("click", () => {
      selected = c;
      // Schakel de "geselecteerd"-markering tussen alle vlakken
      paletteDiv
        .querySelectorAll(".color-picker")
        .forEach((s) => s.classList.toggle("selected", s === swatch));
    });
    if (c === selected) swatch.classList.add("selected");
    paletteDiv.appendChild(swatch);
  });

  return { getColor: () => selected };
}

// --------------------------------------------------------------------------
// Nieuwe-notitie-weergave
// --------------------------------------------------------------------------

// Koppelt de Opslaan-knop aan het formulier voor nieuwe notities.
// De knop wordt gekloond en vervangen elke keer dat dit wordt uitgevoerd om te voorkomen
// dat event-listeners zich opstapelen bij meerdere bezoeken aan deze weergave.
function attachSaveHandler(palette) {
  const saveBtn = document.getElementById("save-note");
  const freshSaveBtn = saveBtn.cloneNode(true);
  saveBtn.replaceWith(freshSaveBtn);

  document.getElementById("save-note").addEventListener("click", () => {
    const title = document.getElementById("note-title").value.trim();
    const url = document.getElementById("note-url").value.trim();
    const text = document.getElementById("note-text").value.trim();
    // Vereist minstens een titel of bodytekst voordat opslaan is toegestaan
    if (!text && !title) return;
    const color = (palette && palette.getColor()) || "#ffffff";
    loadNotes((notes) => {
      notes.push({ title, url, text, color });
      saveNotes(notes, showHome);
    });
  });

  document.getElementById("cancel-note").addEventListener("click", showHome);
}

// Als de auto-link-instelling is ingeschakeld, vult het opgegeven URL-invoerveld
// automatisch met de URL van het huidige tabblad, zodat de gebruiker niet handmatig hoeft te kopiëren.
function autoFillUrlField(fieldID) {
  getAutoLinkSetting((enabled) => {
    if (!enabled) return;
    getCurrentTabUrl((url) => {
      const urlField = document.getElementById(fieldID);
      if (urlField) urlField.value = url;
    });
  });
}

function showNewNote() {
  hideAllViews();
  document.getElementById("title").textContent = "Create note";
  document.getElementById("new-note-view").classList.remove("hidden");

  // Wis alle waarden die zijn achtergebleven van een vorig bezoek aan deze weergave
  document.getElementById("note-title").value = "";
  document.getElementById("note-url").value = "";
  document.getElementById("note-text").value = "";

  // Herrender het palet zodat de selectie terugvalt op de standaardkleur
  const paletteDiv = document.getElementById("color-palette");
  paletteDiv.innerHTML = "";
  const palette = setupColorPalette("color-palette");

  autoFillUrlField("note-url");
  attachSaveHandler(palette);
}

// --------------------------------------------------------------------------
// Spraaknotitie-weergave
// --------------------------------------------------------------------------

function newVoiceNote() {
  // navigator.permissions.query({ name: "microphone" }) wordt niet ondersteund in
  // Firefox, dus we slaan het volledig over en roepen getUserMedia direct aan.
  // Als toestemming wordt geweigerd, handelt het catch-blok dit af.
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      hideAllViews();

      const mediaRecorder = new MediaRecorder(stream);
      // Bewakingsvlag voorkomt dat de gebruiker dubbel start of stopt
      let isRecording = false;

      document.getElementById("voiceRecording").classList.remove("hidden");

      // Gebruik de eigen paletcontainer van de spraaknotitie — niet het palet van de
      // bewerk-weergave, die hetzelfde DOM deelt maar het verkeerde element zou zijn
      const paletteDiv = document.getElementById("color-palette-voice-note");
      paletteDiv.innerHTML = "";
      const palette = setupColorPalette("color-palette-voice-note");

      autoFillUrlField("audio-note-url");

      const startBtn = document.getElementById("startRecording");
      const stopBtn = document.getElementById("stopRecording");
      // Stop begint uitgeschakeld zodat de gebruiker eerst op Start moet drukken
      stopBtn.disabled = true;

      startBtn.onclick = () => {
        if (isRecording) return; // Voorkom dubbel starten
        isRecording = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        document.getElementById("recording-status").textContent =
          "Recording...";
        mediaRecorder.start();
      };

      stopBtn.onclick = () => {
        if (!isRecording) return; // Voorkom dubbel stoppen
        isRecording = false;
        document.getElementById("recording-status").textContent =
          "Saving...";
        mediaRecorder.stop();
        // Geef de microfoon direct vrij — houd hem niet vast nadat de opname eindigt
        stream.getTracks().forEach((track) => track.stop());
      };

      // ondataavailable wordt eenmaal aangeroepen na mediaRecorder.stop() met de volledige blob
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;

        // Blob-URL's zijn tijdelijk en gekoppeld aan de huidige paginasessie — ze worden
        // ongeldig wanneer de popup sluit. We converteren naar een Base64-data-URL
        // zodat de audio duurzaam kan worden opgeslagen en later afgespeeld.
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result; // bijv. "data:audio/webm;base64,..."
          const title =
            document.getElementById("audio-note-title").value.trim() ||
            "Voice Note";
          // `url` slaat de paginalink op; `audioUrl` slaat de audiodata apart op
          // zodat ze elkaar nooit overschrijven
          const pageUrl = document
            .getElementById("audio-note-url")
            .value.trim();
          const color = palette.getColor();
          loadNotes((notes) => {
            notes.push({
              title,
              url: pageUrl,
              audioUrl: base64Audio,
              text: "",
              color,
            });
            saveNotes(notes, showHome);
          });
        };
        reader.readAsDataURL(event.data);
      };
    })
    .catch((err) => {
      // getUserMedia mislukt — toestemming geweigerd of geen microfoon beschikbaar.
      // Open de speciale toestemmingshelperpagina als terugvaloptie.
      console.error("Error accessing microphone", err);
      browserAPI.tabs.create({
        url: browserAPI.runtime.getURL("recorder.html"),
      });
    });
}

// --------------------------------------------------------------------------
// Alle notities wissen
// --------------------------------------------------------------------------

// Toont een bevestigingsvenster voordat alle notities uit de opslag worden verwijderd.
function confirmClearAll() {
  const confirmDiv = document.getElementById("confirm-clear-all");
  confirmDiv.classList.remove("hidden");
  document.getElementById("confirm-overlay").classList.remove("hidden");

  const confirmBtn = document.getElementById("confirm-clear-btn");
  const cancelBtn = document.getElementById("cancel-clear-btn");

  confirmBtn.onclick = () => {
    saveNotes([], showHome); // Overschrijf de opslag met een lege array
  };
  cancelBtn.onclick = () => {
    confirmDiv.classList.add("hidden");
    document.getElementById("confirm-overlay").classList.add("hidden");
  };
}

// --------------------------------------------------------------------------
// Instellingenweergave
// --------------------------------------------------------------------------

function showSettings() {
  hideAllViews();
  document.getElementById("title").textContent = "Settings";
  document.getElementById("settings-view").classList.remove("hidden");

  // Lees de huidige auto-link-instelling asynchroon en koppel vervolgens het selectievakje.
  // Het selectievakje-element wordt gekloond om opeenstapeling van listeners bij herhaalde bezoeken te voorkomen.
  getAutoLinkSetting((enabled) => {
    const checkbox = document.getElementById("auto-link-toggle");
    const freshCheckbox = checkbox.cloneNode(true);
    checkbox.replaceWith(freshCheckbox);
    freshCheckbox.checked = enabled;
    freshCheckbox.addEventListener("change", (e) =>
      setAutoLinkSetting(e.target.checked),
    );
  });

  // Kloon de wisknop om dezelfde reden als het selectievakje hierboven
  const clearBtn = document.getElementById("clear-notes");
  const freshClear = clearBtn.cloneNode(true);
  clearBtn.replaceWith(freshClear);
  freshClear.addEventListener("click", confirmClearAll);
}

// --------------------------------------------------------------------------
// Notitiedetailweergave
// --------------------------------------------------------------------------

// Toont de volledige inhoud van de notitie op `index`.
// Spraaknotities tonen een <audio>-speler; tekstnotities tonen de bodytekst.
function showNoteAt(index) {
  loadNotes((notes) => {
    const note = notes[index];
    if (!note) return;

    hideAllViews();

    const titleEl = document.getElementById("title");
    titleEl.textContent = note.title || "(no title)";
    titleEl.className = "title";

    // Pas de kleur van de notitie toe op de detailkaart via CSS-aangepaste eigenschappen
    const detailView = document.getElementById("note-detail-view");
    detailView.style.setProperty("--note-bg", note.color || "#fff");
    detailView.style.setProperty(
      "--note-border",
      note.color ? darkenColor(note.color) : "#ccc",
    );

    // Toon de bijbehorende website-URL als klikbare link, of verberg hem volledig
    const urlEl = document.getElementById("detail-url");
    if (note.url) {
      urlEl.href = note.url;
      urlEl.textContent = note.url;
      urlEl.classList.remove("hidden");
    } else {
      urlEl.classList.add("hidden");
    }

    const textEl = document.getElementById("detail-text");

    if (note.audioUrl) {
      // Spraaknotitie: voeg een <audio>-speler in die verwijst naar de opgeslagen Base64-data-URL
      textEl.innerHTML = "";
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = note.audioUrl;
      audio.style.width = "100%";
      audio.style.marginTop = "8px";
      textEl.appendChild(audio);
      textEl.classList.remove("hidden");
    } else if (note.text) {
      // Tekstnotitie: render de bodytekst
      textEl.textContent = note.text;
      textEl.classList.remove("hidden");
    } else {
      textEl.classList.add("hidden");
    }

    // Wijs actieknoppen handlers toe met de huidige notitie-index vastgelegd
    document.getElementById("detail-back").onclick = showHome;
    document.getElementById("detail-delete").onclick = () =>
      confirmDeleteNoteAt(index);
    document.getElementById("detail-edit").onclick = () => editNoteAt(index);

    detailView.classList.remove("hidden");
  });
}

// --------------------------------------------------------------------------
// Notitie bewerken weergave
// --------------------------------------------------------------------------

function editNoteAt(index) {
  loadNotes((notes) => {
    const note = notes[index];
    if (!note) return;

    hideAllViews();
    document.getElementById("title").textContent = "Edit Note";
    document.getElementById("edit-Note").classList.remove("hidden");

    // Vul de formuliervelden vooraf in met de bestaande waarden van de notitie
    document.getElementById("edit-note-title").value = note.title || "";
    document.getElementById("edit-note-url").value = note.url || "";
    document.getElementById("edit-note-text").value = note.text || "";

    // Herrender het palet zodat de standaardkleursel teruggezet wordt
    const paletteDiv = document.getElementById("edit-color-palette");
    paletteDiv.innerHTML = "";
    const palette = setupColorPalette("edit-color-palette");

    document.getElementById("update-note").onclick = () => {
      const title = document.getElementById("edit-note-title").value.trim();
      const url = document.getElementById("edit-note-url").value.trim();
      const text = document.getElementById("edit-note-text").value.trim();
      if (!text && !title) return;
      // Pas het notitieobject in-place aan en schrijf vervolgens de volledige array terug naar de opslag
      note.title = title;
      note.url = url;
      note.text = text;
      note.color = palette.getColor();
      saveNotes(notes, showHome);
    };

    document.getElementById("cancel-edit-note").onclick = showHome;
  });
}

// --------------------------------------------------------------------------
// Initialisatie — wordt eenmalig uitgevoerd wanneer de popup-DOM volledig is geladen
// --------------------------------------------------------------------------

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("home-button").addEventListener("click", showHome);
  document
    .getElementById("make-new-notes")
    .addEventListener("click", showNewNote);
  document
    .getElementById("makeVoiceRecording")
    .addEventListener("click", newVoiceNote);
  document
    .getElementById("setting-button")
    .addEventListener("click", showSettings);

  // Render de startweergave direct wanneer de popup opent
  showHome();
});
