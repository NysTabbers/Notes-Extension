// utility functions for notes storage
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

// settings helpers
function getAutoLinkSetting() {
  return localStorage.getItem('autoLink') !== 'false';
}

function setAutoLinkSetting(value) {
  localStorage.setItem('autoLink', value);
}

// get current tab's URL
function getCurrentTabUrl(callback) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    callback(tabs[0]?.url || '');
  });
}

// helpers for random appearance
function randomColor() {
  const colors = ['#fffa65', '#ffd3b4', '#baffc9', '#ffb3ba', '#bde0fe'];
  return colors[Math.floor(Math.random() * colors.length)];
}


function showHome() {
  const notes = loadNotes();
  const content = document.getElementById('note-content');
  const title = document.getElementById('title');
  title.textContent = 'My Notes';
  content.innerHTML = '';
  if (!notes.length) {
    content.innerHTML = '<p>No notes yet. Click the + button to add one.</p>';
    return;
  }
  // existing notes-container styling may still apply
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

function showNewNote() {
  const content = document.getElementById('note-content');
  const titleEl = document.getElementById('title');
  titleEl.textContent = 'Create note';
  content.innerHTML = `
    <h2>Create a new note</h2>
    <input id="note-title" placeholder="Title" class="note-input" />
    <input id="note-url" placeholder="Link (URL)" class="note-input" />
    <textarea id="note-text" rows="6" class="note-textarea"></textarea>
    <button id="save-note">Save</button>
  `;
  
  // auto-populate URL if setting is on
  if (getAutoLinkSetting()) {
    getCurrentTabUrl((url) => {
      const urlField = document.getElementById('note-url');
      if (urlField) {
        urlField.value = url;
      }
    });
  }
  
  document.getElementById('save-note').addEventListener('click', () => {
    const title = document.getElementById('note-title').value.trim();
    const url = document.getElementById('note-url').value.trim();
    const text = document.getElementById('note-text').value.trim();
    if (!text && !title) return;
    const notes = loadNotes();
    notes.push({ 
      title,
      url,
      text, 
      color: randomColor()
    });
    saveNotes(notes);
    showHome();
  });
}

function showSettings() {
  const content = document.getElementById('note-content');
  const titleEl = document.getElementById('title');
  titleEl.textContent = 'Settings';
  const autoLinkOn = getAutoLinkSetting();
  content.innerHTML = `
    <h2>Settings</h2>
    <label>
      <input type="checkbox" id="auto-link-toggle" ${autoLinkOn ? 'checked' : ''} />
      Auto-grab website link when creating notes
    </label>
    <button id="clear-notes" class="clear-notes">Clear all notes</button>
  `;
  
  document.getElementById('auto-link-toggle').addEventListener('change', (e) => {
    setAutoLinkSetting(e.target.checked);
  });
  
  document.getElementById('clear-notes').addEventListener('click', () => {
    if (confirm('Delete all notes?')) {
      saveNotes([]);
      showHome();
    }
  });
}

// helper for showing individual note
function showNoteAt(index) {
  const notes = loadNotes();
  const note = notes[index];
  if (!note) return;
  const content = document.getElementById('note-content');
  const titleEl = document.getElementById('title');
  titleEl.textContent = note.title || '(no title)';
  const linkHtml = note.url ? `<p><a href="${note.url}" target="_blank">${note.url}</a></p>` : '';
  content.innerHTML = `${linkHtml}
                         <p>${note.text || ''}</p>
                         <button id="back-home">Back</button>`;
  document.getElementById('back-home').addEventListener('click', showHome);
}

// wire up buttons
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('home-button').addEventListener('click', showHome);
  document.getElementById('make-new-notes').addEventListener('click', showNewNote);
  document.getElementById('setting-button').addEventListener('click', showSettings);
  showHome();
});
