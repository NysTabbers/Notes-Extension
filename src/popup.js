// Cross-browser API compatibility (Chrome + Firefox)
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

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

function saveNotes(notes, callback) {
  browserAPI.storage.local.set({ notes }, () => {
    if (callback) callback();
  });
}

function getAutoLinkSetting(callback) {
  browserAPI.storage.local.get("autoLink", (result) => {
    callback(result.autoLink !== false);
  });
}

function setAutoLinkSetting(value) {
  browserAPI.storage.local.set({ autoLink: value });
}

function getCurrentTabUrl(callback) {
  browserAPI.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    callback(tabs[0]?.url || "");
  });
}

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

function darkenColor(hex, amount = 40) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

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

    const notesContainer = document.createElement("div");
    notesContainer.className = "notes-container";

    notes.forEach((note, idx) => {
      const div = document.createElement("div");
      div.className = "note-sticky";
      div.textContent = note.title || "(no title)";
      if (note.color) div.style.setProperty("--bg", note.color);
      div.addEventListener("click", () => showNoteAt(idx));
      notesContainer.appendChild(div);
    });

    content.appendChild(notesContainer);
  });
}

function deleteNoteAt(index) {
  loadNotes((notes) => {
    notes.splice(index, 1);
    saveNotes(notes, showHome);
  });
}

function confirmDeleteNoteAt(index) {
  const confirmDiv = document.getElementById("confirm-delete");
  confirmDiv.classList.remove("hidden");
  document.getElementById("confirm-overlay").classList.remove("hidden");

  const confirmBtn = document.getElementById("confirm-delete-btn");
  const cancelBtn = document.getElementById("cancel-delete-btn");

  confirmBtn.onclick = () => {
    deleteNoteAt(index);
  };
  cancelBtn.onclick = () => {
    confirmDiv.classList.add("hidden");
    document.getElementById("confirm-overlay").classList.add("hidden");
  };
}

function setupColorPalette(
  containerId,
  colors = ["#fffa65", "#ffd3b4", "#baffc9", "#ffb3ba", "#bde0fe", "#ffffff"],
) {
  let selected = colors[0];
  const paletteDiv = document.getElementById(containerId);

  colors.forEach((c) => {
    const swatch = document.createElement("span");
    swatch.className = "color-picker";
    swatch.style.background = c;
    swatch.dataset.color = c;
    swatch.addEventListener("click", () => {
      selected = c;
      paletteDiv
        .querySelectorAll(".color-picker")
        .forEach((s) => s.classList.toggle("selected", s === swatch));
    });
    if (c === selected) swatch.classList.add("selected");
    paletteDiv.appendChild(swatch);
  });

  return { getColor: () => selected };
}

function attachSaveHandler(palette) {
  const saveBtn = document.getElementById("save-note");
  const freshSaveBtn = saveBtn.cloneNode(true);
  saveBtn.replaceWith(freshSaveBtn);
  document.getElementById("save-note").addEventListener("click", () => {
    const title = document.getElementById("note-title").value.trim();
    const url = document.getElementById("note-url").value.trim();
    const text = document.getElementById("note-text").value.trim();
    if (!text && !title) return;
    const color = (palette && palette.getColor()) || "#ffffff";
    loadNotes((notes) => {
      notes.push({ title, url, text, color });
      saveNotes(notes, showHome);
    });
  });
  document.getElementById("cancel-note").addEventListener("click", showHome);
}

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

  document.getElementById("note-title").value = "";
  document.getElementById("note-url").value = "";
  document.getElementById("note-text").value = "";

  const paletteDiv = document.getElementById("color-palette");
  paletteDiv.innerHTML = "";
  const palette = setupColorPalette("color-palette");

  autoFillUrlField("note-url");
  attachSaveHandler(palette);
}

function newVoiceNote() {
  // Go straight to getUserMedia — skip permissions.query (broken in Firefox)
  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      hideAllViews();

      const mediaRecorder = new MediaRecorder(stream);
      let isRecording = false;

      document.getElementById("voiceRecording").classList.remove("hidden");

      // Fix: use the correct voice note palette container, not the edit one
      const paletteDiv = document.getElementById("color-palette-voice-note");
      paletteDiv.innerHTML = "";
      const palette = setupColorPalette("color-palette-voice-note");

      autoFillUrlField("audio-note-url");

      const startBtn = document.getElementById("startRecording");
      const stopBtn = document.getElementById("stopRecording");
      stopBtn.disabled = true;

      startBtn.onclick = () => {
        if (isRecording) return;
        isRecording = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        document.getElementById("recording-status").textContent = "🔴 Recording...";
        mediaRecorder.start();
      };

      stopBtn.onclick = () => {
        if (!isRecording) return;
        isRecording = false;
        document.getElementById("recording-status").textContent = "⏳ Saving...";
        mediaRecorder.stop();
        // Stop mic tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;

        // Convert blob to Base64 so it can be persisted in storage
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result; // data:audio/...;base64,...
          const title =
            document.getElementById("audio-note-title").value.trim() ||
            "Voice Note";
          // Fix: store the page URL in `url` and the audio data in `audioUrl`
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
      // Permission denied or no mic — open the permission helper tab
      console.error("Error accessing microphone", err);
      browserAPI.tabs.create({ url: browserAPI.runtime.getURL("recorder.html") });
    });
}

function confirmClearAll() {
  const confirmDiv = document.getElementById("confirm-clear-all");
  confirmDiv.classList.remove("hidden");
  document.getElementById("confirm-overlay").classList.remove("hidden");

  const confirmBtn = document.getElementById("confirm-clear-btn");
  const cancelBtn = document.getElementById("cancel-clear-btn");

  confirmBtn.onclick = () => {
    saveNotes([], showHome);
  };
  cancelBtn.onclick = () => {
    confirmDiv.classList.add("hidden");
    document.getElementById("confirm-overlay").classList.add("hidden");
  };
}

function showSettings() {
  hideAllViews();
  document.getElementById("title").textContent = "Settings";
  document.getElementById("settings-view").classList.remove("hidden");

  getAutoLinkSetting((enabled) => {
    const checkbox = document.getElementById("auto-link-toggle");

    const freshCheckbox = checkbox.cloneNode(true);
    checkbox.replaceWith(freshCheckbox);
    freshCheckbox.checked = enabled;
    freshCheckbox.addEventListener("change", (e) =>
      setAutoLinkSetting(e.target.checked),
    );
  });

  const clearBtn = document.getElementById("clear-notes");
  const freshClear = clearBtn.cloneNode(true);
  clearBtn.replaceWith(freshClear);
  freshClear.addEventListener("click", confirmClearAll);
}

function showNoteAt(index) {
  loadNotes((notes) => {
    const note = notes[index];
    if (!note) return;

    hideAllViews();

    const titleEl = document.getElementById("title");
    titleEl.textContent = note.title || "(no title)";
    titleEl.className = "title";

    const detailView = document.getElementById("note-detail-view");
    detailView.style.setProperty("--note-bg", note.color || "#fff");
    detailView.style.setProperty(
      "--note-border",
      note.color ? darkenColor(note.color) : "#ccc",
    );

    const urlEl = document.getElementById("detail-url");
    if (note.url) {
      urlEl.href = note.url;
      urlEl.textContent = note.url;
      urlEl.classList.remove("hidden");
    } else {
      urlEl.classList.add("hidden");
    }

    const textEl = document.getElementById("detail-text");

    // If it's a voice note, show an audio player instead of text
    if (note.audioUrl) {
      textEl.innerHTML = "";
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = note.audioUrl;
      audio.style.width = "100%";
      audio.style.marginTop = "8px";
      textEl.appendChild(audio);
      textEl.classList.remove("hidden");
    } else if (note.text) {
      textEl.textContent = note.text;
      textEl.classList.remove("hidden");
    } else {
      textEl.classList.add("hidden");
    }

    document.getElementById("detail-back").onclick = showHome;
    document.getElementById("detail-delete").onclick = () =>
      confirmDeleteNoteAt(index);
    document.getElementById("detail-edit").onclick = () => editNoteAt(index);

    detailView.classList.remove("hidden");
  });
}

function editNoteAt(index) {
  loadNotes((notes) => {
    const note = notes[index];
    if (!note) return;

    hideAllViews();
    document.getElementById("title").textContent = "Edit Note";
    document.getElementById("edit-Note").classList.remove("hidden");

    document.getElementById("edit-note-title").value = note.title || "";
    document.getElementById("edit-note-url").value = note.url || "";
    document.getElementById("edit-note-text").value = note.text || "";

    const paletteDiv = document.getElementById("edit-color-palette");
    paletteDiv.innerHTML = "";
    const palette = setupColorPalette("edit-color-palette");

    document.getElementById("update-note").onclick = () => {
      const title = document.getElementById("edit-note-title").value.trim();
      const url = document.getElementById("edit-note-url").value.trim();
      const text = document.getElementById("edit-note-text").value.trim();
      if (!text && !title) return;
      note.title = title;
      note.url = url;
      note.text = text;
      note.color = palette.getColor();
      saveNotes(notes, showHome);
    };
    document.getElementById("cancel-edit-note").onclick = showHome;
  });
}

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
  showHome();
});
