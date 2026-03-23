// Cross-browser API compatibility shim.
// Firefox exposes the WebExtensions API as `browser`, Chrome uses `chrome`.
// This single variable lets the rest of the code work in both without branching.
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// --------------------------------------------------------------------------
// Storage helpers
// All note data and settings are stored in chrome.storage.local rather than
// localStorage. localStorage can be unreliable in extension popups and is not
// shared across contexts. chrome.storage.local works correctly in both Chrome
// and Firefox and persists across popup opens.
// --------------------------------------------------------------------------

// Loads the notes array from storage and passes it to the callback.
// Falls back to an empty array if nothing is stored yet or if data is corrupted.
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

// Persists the full notes array to storage.
// The optional callback is called once the write completes — used to chain
// actions like navigating back to the home view after a save.
function saveNotes(notes, callback) {
  browserAPI.storage.local.set({ notes }, () => {
    if (callback) callback();
  });
}

// Reads the auto-link setting from storage and passes a boolean to the callback.
// Defaults to true if the setting has never been saved.
function getAutoLinkSetting(callback) {
  browserAPI.storage.local.get("autoLink", (result) => {
    // Treat anything other than an explicit `false` as enabled
    callback(result.autoLink !== false);
  });
}

// Saves the auto-link preference (true/false) to storage.
function setAutoLinkSetting(value) {
  browserAPI.storage.local.set({ autoLink: value });
}

// Queries the currently active tab and returns its URL via callback.
// Uses browserAPI so it works in both Chrome and Firefox.
function getCurrentTabUrl(callback) {
  browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    callback(tabs[0]?.url || "");
  });
}

// --------------------------------------------------------------------------
// View management
// The popup uses a single-page pattern — only one "view" div is visible at a
// time. hideAllViews() clears everything before the desired view is shown.
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
// Colour utilities
// --------------------------------------------------------------------------

// Darkens a hex colour by subtracting `amount` from each RGB channel.
// Used to derive a slightly darker border colour from a note's background colour.
function darkenColor(hex, amount = 40) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// --------------------------------------------------------------------------
// Home view — displays all saved notes as a grid of sticky cards
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

    // Build a grid of sticky cards, one per note
    const notesContainer = document.createElement("div");
    notesContainer.className = "notes-container";

    notes.forEach((note, idx) => {
      const div = document.createElement("div");
      div.className = "note-sticky";
      div.textContent = note.title || "(no title)";
      // Apply the note's saved colour via a CSS custom property
      if (note.color) div.style.setProperty("--bg", note.color);
      // Clicking a card opens the full detail view for that note
      div.addEventListener("click", () => showNoteAt(idx));
      notesContainer.appendChild(div);
    });

    content.appendChild(notesContainer);
  });
}

// --------------------------------------------------------------------------
// Delete note
// --------------------------------------------------------------------------

// Removes the note at `index` from the array, saves, and returns to home.
function deleteNoteAt(index) {
  loadNotes((notes) => {
    notes.splice(index, 1);
    saveNotes(notes, showHome);
  });
}

// Shows the confirmation dialog before committing a delete.
function confirmDeleteNoteAt(index) {
  const confirmDiv = document.getElementById("confirm-delete");
  confirmDiv.classList.remove("hidden");
  document.getElementById("confirm-overlay").classList.remove("hidden");

  const confirmBtn = document.getElementById("confirm-delete-btn");
  const cancelBtn = document.getElementById("cancel-delete-btn");

  // Use .onclick rather than addEventListener so that re-opening the dialog
  // replaces the handler instead of stacking duplicate listeners
  confirmBtn.onclick = () => {
    deleteNoteAt(index);
  };
  cancelBtn.onclick = () => {
    confirmDiv.classList.add("hidden");
    document.getElementById("confirm-overlay").classList.add("hidden");
  };
}

// --------------------------------------------------------------------------
// Colour palette widget
// Renders a row of colour swatches inside the element with id `containerId`.
// Returns a { getColor() } object so the caller can read the current selection.
// --------------------------------------------------------------------------

function setupColorPalette(
  containerId,
  colors = ["#fffa65", "#ffd3b4", "#baffc9", "#ffb3ba", "#bde0fe", "#ffffff"],
) {
  let selected = colors[0]; // Default to the first colour in the list
  const paletteDiv = document.getElementById(containerId);

  colors.forEach((c) => {
    const swatch = document.createElement("span");
    swatch.className = "color-picker";
    swatch.style.background = c;
    swatch.dataset.color = c;
    swatch.addEventListener("click", () => {
      selected = c;
      // Toggle the "selected" highlight border across all swatches
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
// New note view
// --------------------------------------------------------------------------

// Wires up the Save button for the new note form.
// The button is cloned and replaced each time this runs to prevent duplicate
// event listeners accumulating across multiple visits to this view.
function attachSaveHandler(palette) {
  const saveBtn = document.getElementById("save-note");
  const freshSaveBtn = saveBtn.cloneNode(true);
  saveBtn.replaceWith(freshSaveBtn);

  document.getElementById("save-note").addEventListener("click", () => {
    const title = document.getElementById("note-title").value.trim();
    const url = document.getElementById("note-url").value.trim();
    const text = document.getElementById("note-text").value.trim();
    // Require at least a title or body text before allowing a save
    if (!text && !title) return;
    const color = (palette && palette.getColor()) || "#ffffff";
    loadNotes((notes) => {
      notes.push({ title, url, text, color });
      saveNotes(notes, showHome);
    });
  });

  document.getElementById("cancel-note").addEventListener("click", showHome);
}

// If the auto-link setting is enabled, fills the specified URL input field
// with the current tab's URL, saving the user a manual copy-paste.
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

  // Clear any values left over from a previous visit to this view
  document.getElementById("note-title").value = "";
  document.getElementById("note-url").value = "";
  document.getElementById("note-text").value = "";

  // Re-render the palette so the selection resets to the default colour
  const paletteDiv = document.getElementById("color-palette");
  paletteDiv.innerHTML = "";
  const palette = setupColorPalette("color-palette");

  autoFillUrlField("note-url");
  attachSaveHandler(palette);
}

// --------------------------------------------------------------------------
// Voice note view
// --------------------------------------------------------------------------

function newVoiceNote() {
  // navigator.permissions.query({ name: "microphone" }) is not supported in
  // Firefox, so we skip it entirely and call getUserMedia directly.
  // If permission is denied, the catch block handles it instead.
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      hideAllViews();

      const mediaRecorder = new MediaRecorder(stream);
      // Guard flag prevents the user from double-starting or double-stopping
      let isRecording = false;

      document.getElementById("voiceRecording").classList.remove("hidden");

      // Use the voice note's own palette container — not the edit note's palette,
      // which shares the same DOM but would be the wrong element
      const paletteDiv = document.getElementById("color-palette-voice-note");
      paletteDiv.innerHTML = "";
      const palette = setupColorPalette("color-palette-voice-note");

      autoFillUrlField("audio-note-url");

      const startBtn = document.getElementById("startRecording");
      const stopBtn = document.getElementById("stopRecording");
      // Stop starts disabled so the user must press Start first
      stopBtn.disabled = true;

      startBtn.onclick = () => {
        if (isRecording) return; // Prevent double-start
        isRecording = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        document.getElementById("recording-status").textContent = "🔴 Recording...";
        mediaRecorder.start();
      };

      stopBtn.onclick = () => {
        if (!isRecording) return; // Prevent double-stop
        isRecording = false;
        document.getElementById("recording-status").textContent = "⏳ Saving...";
        mediaRecorder.stop();
        // Release the microphone immediately — don't hold it after recording ends
        stream.getTracks().forEach((track) => track.stop());
      };

      // ondataavailable fires once after mediaRecorder.stop() with the full blob
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;

        // Blob URLs are temporary and tied to the current page session — they
        // become invalid when the popup closes. We convert to a Base64 data URL
        // so the audio can be stored persistently and played back later.
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result; // e.g. "data:audio/webm;base64,..."
          const title =
            document.getElementById("audio-note-title").value.trim() ||
            "Voice Note";
          // `url` stores the page link; `audioUrl` stores the audio data separately
          // so they never overwrite each other
          const pageUrl = document.getElementById("audio-note-url").value.trim();
          const color = palette.getColor();
          loadNotes((notes) => {
            notes.push({ title, url: pageUrl, audioUrl: base64Audio, text: "", color });
            saveNotes(notes, showHome);
          });
        };
        reader.readAsDataURL(event.data);
      };
    })
    .catch((err) => {
      // getUserMedia failed — either permission denied or no mic available.
      // Open the dedicated permission helper page as a fallback.
      console.error("Error accessing microphone", err);
      browserAPI.tabs.create({ url: browserAPI.runtime.getURL("recorder.html") });
    });
}

// --------------------------------------------------------------------------
// Clear all notes
// --------------------------------------------------------------------------

// Shows a confirmation dialog before wiping all notes from storage.
function confirmClearAll() {
  const confirmDiv = document.getElementById("confirm-clear-all");
  confirmDiv.classList.remove("hidden");
  document.getElementById("confirm-overlay").classList.remove("hidden");

  const confirmBtn = document.getElementById("confirm-clear-btn");
  const cancelBtn = document.getElementById("cancel-clear-btn");

  confirmBtn.onclick = () => {
    saveNotes([], showHome); // Overwrite storage with an empty array
  };
  cancelBtn.onclick = () => {
    confirmDiv.classList.add("hidden");
    document.getElementById("confirm-overlay").classList.add("hidden");
  };
}

// --------------------------------------------------------------------------
// Settings view
// --------------------------------------------------------------------------

function showSettings() {
  hideAllViews();
  document.getElementById("title").textContent = "Settings";
  document.getElementById("settings-view").classList.remove("hidden");

  // Read the current auto-link setting asynchronously, then wire up the checkbox.
  // The checkbox element is cloned to prevent listener accumulation across visits.
  getAutoLinkSetting((enabled) => {
    const checkbox = document.getElementById("auto-link-toggle");
    const freshCheckbox = checkbox.cloneNode(true);
    checkbox.replaceWith(freshCheckbox);
    freshCheckbox.checked = enabled;
    freshCheckbox.addEventListener("change", (e) =>
      setAutoLinkSetting(e.target.checked),
    );
  });

  // Clone the clear button for the same reason as the checkbox above
  const clearBtn = document.getElementById("clear-notes");
  const freshClear = clearBtn.cloneNode(true);
  clearBtn.replaceWith(freshClear);
  freshClear.addEventListener("click", confirmClearAll);
}

// --------------------------------------------------------------------------
// Note detail view
// --------------------------------------------------------------------------

// Shows the full content of the note at `index`.
// Voice notes render an <audio> player element; text notes render body text.
function showNoteAt(index) {
  loadNotes((notes) => {
    const note = notes[index];
    if (!note) return;

    hideAllViews();

    const titleEl = document.getElementById("title");
    titleEl.textContent = note.title || "(no title)";
    titleEl.className = "title";

    // Apply the note's colour to the detail card via CSS custom properties
    const detailView = document.getElementById("note-detail-view");
    detailView.style.setProperty("--note-bg", note.color || "#fff");
    detailView.style.setProperty(
      "--note-border",
      note.color ? darkenColor(note.color) : "#ccc",
    );

    // Show the associated website URL as a clickable link, or hide it entirely
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
      // Voice note: inject an <audio> player pointing at the stored Base64 data URL
      textEl.innerHTML = "";
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = note.audioUrl;
      audio.style.width = "100%";
      audio.style.marginTop = "8px";
      textEl.appendChild(audio);
      textEl.classList.remove("hidden");
    } else if (note.text) {
      // Text note: render the body text
      textEl.textContent = note.text;
      textEl.classList.remove("hidden");
    } else {
      textEl.classList.add("hidden");
    }

    // Assign action button handlers with the current note's index captured
    document.getElementById("detail-back").onclick = showHome;
    document.getElementById("detail-delete").onclick = () =>
      confirmDeleteNoteAt(index);
    document.getElementById("detail-edit").onclick = () => editNoteAt(index);

    detailView.classList.remove("hidden");
  });
}

// --------------------------------------------------------------------------
// Edit note view
// --------------------------------------------------------------------------

function editNoteAt(index) {
  loadNotes((notes) => {
    const note = notes[index];
    if (!note) return;

    hideAllViews();
    document.getElementById("title").textContent = "Edit Note";
    document.getElementById("edit-Note").classList.remove("hidden");

    // Pre-fill the form fields with the note's existing values
    document.getElementById("edit-note-title").value = note.title || "";
    document.getElementById("edit-note-url").value = note.url || "";
    document.getElementById("edit-note-text").value = note.text || "";

    // Re-render the palette fresh so it resets to the default colour selection
    const paletteDiv = document.getElementById("edit-color-palette");
    paletteDiv.innerHTML = "";
    const palette = setupColorPalette("edit-color-palette");

    document.getElementById("update-note").onclick = () => {
      const title = document.getElementById("edit-note-title").value.trim();
      const url = document.getElementById("edit-note-url").value.trim();
      const text = document.getElementById("edit-note-text").value.trim();
      if (!text && !title) return;
      // Mutate the note object in-place, then write the whole array back to storage
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
// Initialisation — runs once when the popup DOM is fully loaded
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

  // Render the home view immediately when the popup opens
  showHome();
});
