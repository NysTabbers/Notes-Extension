function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem('notes') || '[]');
  } catch (e) {
    console.error('failed to load notes', e);
    return [];
  }
}

function saveNotes(notes) {
  localStorage.setItem('notes', JSON.stringify(notes));
}

function getAutoLinkSetting() {
  return localStorage.getItem('autoLink') !== 'false';
}

function setAutoLinkSetting(value) {
  localStorage.setItem('autoLink', value);
}

function getCurrentTabUrl(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    callback(tabs[0]?.url || '');
  });
}

function hideAllViews() {
  document.getElementById('home-view').classList.add('hidden');
  document.getElementById('note-detail-view').classList.add('hidden');
  document.getElementById('new-note-view').classList.add('hidden');
  document.getElementById('settings-view').classList.add('hidden');
  document.getElementById('confirm-delete').classList.add('hidden');
  document.getElementById('confirm-overlay').classList.add('hidden');
  document.getElementById('confirm-clear-all').classList.add('hidden');
  document.getElementById('edit-Note').classList.add('hidden');
}

function darkenColor(hex, amount = 40) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}


function showHome() {
  hideAllViews();

  const titleEl = document.getElementById('title');
  titleEl.textContent = 'My Notes';
  titleEl.style.background = '';

  document.getElementById('home-view').classList.remove('hidden');

  const notes = loadNotes();
  const content = document.getElementById('note-content');
  content.innerHTML = '';

  if (!notes.length) {
    content.innerHTML = '<p>No notes yet. Click "Make New Note" to add one.</p>';
    return;
  }

  const notesContainer = document.createElement('div');
  notesContainer.className = 'notes-container';

  notes.forEach((note, idx) => {
    const div = document.createElement('div');
    div.className = 'note-sticky';
    div.textContent = note.title || '(no title)';
    if (note.color) div.style.setProperty('--bg', note.color);
    div.addEventListener('click', () => showNoteAt(idx));
    notesContainer.appendChild(div);
  });

  content.appendChild(notesContainer);
}

function deleteNoteAt(index) {
  const notes = loadNotes();
  notes.splice(index, 1);
  saveNotes(notes);
  showHome();
}

function confirmDeleteNoteAt(index) {
  const confirmDiv = document.getElementById('confirm-delete');
  confirmDiv.classList.remove('hidden');
  document.getElementById('confirm-overlay').classList.remove('hidden');

  const confirmBtn = document.getElementById('confirm-delete-btn');
  const cancelBtn = document.getElementById('cancel-delete-btn');

  confirmBtn.onclick = () => { deleteNoteAt(index); };
  cancelBtn.onclick = () => {
    confirmDiv.classList.add('hidden');
    document.getElementById('confirm-overlay').classList.add('hidden');
  };
}

function setupColorPalette(containerId, colors = ['#fffa65', '#ffd3b4', '#baffc9', '#ffb3ba', '#bde0fe', '#ffffff']) {
  let selected = colors[0];
  const paletteDiv = document.getElementById(containerId);

  colors.forEach(c => {
    const swatch = document.createElement('span');
    swatch.className = 'color-picker';
    swatch.style.background = c;
    swatch.dataset.color = c;
    swatch.addEventListener('click', () => {
      selected = c;
      paletteDiv.querySelectorAll('.color-picker').forEach(s => s.classList.toggle('selected', s === swatch));
    });
    if (c === selected) swatch.classList.add('selected');
    paletteDiv.appendChild(swatch);
  });

  return { getColor: () => selected };
}

function attachSaveHandler(palette) {
  document.getElementById('save-note').addEventListener('click', () => {
    const title = document.getElementById('note-title').value.trim();
    const url = document.getElementById('note-url').value.trim();
    const text = document.getElementById('note-text').value.trim();
    if (!text && !title) return;
    const notes = loadNotes();
    const color = (palette && palette.getColor()) || '#ffffff';
    notes.push({ title, url, text, color });
    saveNotes(notes);
    showHome();
  });
  document.getElementById('cancel-note').addEventListener('click', showHome);
}

function autoFillUrlField() {
  if (!getAutoLinkSetting()) return;
  getCurrentTabUrl((url) => {
    const urlField = document.getElementById('note-url');
    if (urlField) urlField.value = url;
  });
}

function showNewNote() {
  hideAllViews();
  document.getElementById('title').textContent = 'Create note';
  document.getElementById('new-note-view').classList.remove('hidden');

  document.getElementById('note-title').value = '';
  document.getElementById('note-url').value = '';
  document.getElementById('note-text').value = '';

  const paletteDiv = document.getElementById('color-palette');
  paletteDiv.innerHTML = '';
  const palette = setupColorPalette('color-palette');

  autoFillUrlField();
  attachSaveHandler(palette);
}

function confirmClearAll() {
  const confirmDiv = document.getElementById('confirm-clear-all');
  confirmDiv.classList.remove('hidden');
  document.getElementById('confirm-overlay').classList.remove('hidden');

  const confirmBtn = document.getElementById('confirm-clear-btn');
  const cancelBtn = document.getElementById('cancel-clear-btn');

  confirmBtn.onclick = () => {
    saveNotes([]);
    showHome();
  };
  cancelBtn.onclick = () => {
    confirmDiv.classList.add('hidden');
    document.getElementById('confirm-overlay').classList.add('hidden');
  };
}

function showSettings() {
  hideAllViews();
  document.getElementById('title').textContent = 'Settings';
  document.getElementById('settings-view').classList.remove('hidden');

  const checkbox = document.getElementById('auto-link-toggle');
  checkbox.checked = getAutoLinkSetting();

  const freshCheckbox = checkbox.cloneNode(true);
  checkbox.replaceWith(freshCheckbox);
  freshCheckbox.checked = getAutoLinkSetting();
  freshCheckbox.addEventListener('change', (e) => setAutoLinkSetting(e.target.checked));

  const clearBtn = document.getElementById('clear-notes');
  const freshClear = clearBtn.cloneNode(true);
  clearBtn.replaceWith(freshClear);
  freshClear.addEventListener('click', confirmClearAll);
}

function showNoteAt(index) {
  const notes = loadNotes();
  const note = notes[index];
  if (!note) return;

  hideAllViews();

  const titleEl = document.getElementById('title');
  titleEl.textContent = note.title || '(no title)';
  titleEl.className = 'title';

  const detailView = document.getElementById('note-detail-view');
  detailView.style.setProperty('--note-bg', note.color || '#fff');
  detailView.style.setProperty('--note-border', note.color ? darkenColor(note.color) : '#ccc');

  const urlEl = document.getElementById('detail-url');
  if (note.url) {
    urlEl.href = note.url;
    urlEl.textContent = note.url;
    urlEl.classList.remove('hidden');
  } else {
    urlEl.classList.add('hidden');
  }

  const textEl = document.getElementById('detail-text');
  if (note.text) {
    textEl.textContent = note.text;
    textEl.classList.remove('hidden');
  } else {
    textEl.classList.add('hidden');
  }

  document.getElementById('detail-back').onclick = showHome;
  document.getElementById('detail-delete').onclick = () => confirmDeleteNoteAt(index);
  document.getElementById('detail-edit').onclick = () => editNoteAt(index);

  detailView.classList.remove('hidden');
}

function editNoteAt(index) {
  // For future implementation: pre-fill the new note form with existing data for editing
  document.getElementById('edit-Note').classList.remove('hidden');
  const notes = loadNotes();
  const note = notes[index];
  if (!note) return;

  hideAllViews();
  document.getElementById('title').textContent = 'Edit Note';
  document.getElementById('edit-Note').classList.remove('hidden');

  document.getElementById('edit-note-title').value = note.title || '';
  document.getElementById('edit-note-url').value = note.url || '';
  document.getElementById('edit-note-text').value = note.text || '';

  const paletteDiv = document.getElementById('edit-color-palette');
  paletteDiv.innerHTML = '';
  const palette = setupColorPalette('edit-color-palette');

  document.getElementById('update-note').onclick = () => {
    const title = document.getElementById('edit-note-title').value.trim();
    const url = document.getElementById('edit-note-url').value.trim();
    const text = document.getElementById('edit-note-text').value.trim();
    if (!text && !title) return;
    note.title = title;
    note.url = url;
    note.text = text;
    note.color = palette.getColor();
    saveNotes(notes);
    showHome();
  };
  document.getElementById('cancel-edit-note').onclick = showHome; 
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('home-button').addEventListener('click', showHome);
  document.getElementById('make-new-notes').addEventListener('click', showNewNote);
  document.getElementById('setting-button').addEventListener('click', showSettings);
  showHome();
});