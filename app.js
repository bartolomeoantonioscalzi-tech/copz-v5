// === APP ===

let appState = {
  contacts: [],
  namedays: [],
  settings: COPZ.loadSettings(),
  currentTab: 'today',
  antiBanLocked: false,
  pendingConfirm: null,
  showOnlyUnsent: false
};

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

// === UI UTILS ===
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function showModal(html) {
  const overlay = $('#modal-overlay');
  overlay.innerHTML = html;
  overlay.classList.remove('hidden');
}

function hideModal() {
  $('#modal-overlay').classList.add('hidden');
  $('#modal-overlay').innerHTML = '';
}

// === POP-UP RESPONSABILITÀ ===
function checkDisclaimers() {
  const s = appState.settings;
  if (!s.acceptedDisclaimer1) {
    showDisclaimer1();
    return false;
  }
  if (!s.acceptedDisclaimer2) {
    showDisclaimer2();
    return false;
  }
  if (!s.signature || !s.signature.trim()) {
    showDisclaimer3();
    return false;
  }
  return true;
}

function showDisclaimer1() {
  showModal(`
    <div class="modal-box">
      <div class="modal-title">⚠️ Responsabilità Contenuti e Frequenza</div>
      <div class="modal-text">
        <p>Utilizzando questa applicazione, l'Utente Finale (UF) accetta <strong>piena responsabilità</strong> per:</p>
        <ul>
          <li>Il contenuto dei messaggi inviati (vietati contenuti offensivi, ricattatori, scurrili o illegali);</li>
          <li>La frequenza dei messaggi inviati alla stessa persona (rischio di reato di stalking).</li>
        </ul>
        <p>L'ideatore dell'app e le eventuali consociate sono <strong>esonorate da qualsiasi responsabilità</strong> per uso improprio da parte dell'UF o di chiunque acceda all'app.</p>
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-secondary" onclick="declineDisclaimer()">Rifiuta</button>
        <button class="modal-btn modal-btn-primary" onclick="acceptDisclaimer1()">Accetto e proseguo</button>
      </div>
    </div>
  `);
}

function showDisclaimer2() {
  showModal(`
    <div class="modal-box">
      <div class="modal-title">⚠️ Rischi di Blocco Telegram / WhatsApp</div>
      <div class="modal-text">
        <p>L'invio ripetuto di messaggi può comportare <strong>blocchi temporanei o definitivi</strong> da parte di Telegram e WhatsApp.</p>
        <p>L'ideatore e le consociate sono <strong>esonerate da responsabilità</strong> rispetto a tali blocchi.</p>
        <p><strong>Suggerimenti per l'UF:</strong></p>
        <ul>
          <li>Cadenzare gli invii nell'arco della giornata;</li>
          <li>Accettare la rotazione dei testi dei messaggi;</li>
          <li>Utilizzare le 3 varianti per compleanni e 5 per onomastici.</li>
        </ul>
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-secondary" onclick="declineDisclaimer()">Rifiuta</button>
        <button class="modal-btn modal-btn-primary" onclick="acceptDisclaimer2()">Accetto e proseguo</button>
      </div>
    </div>
  `);
}

function showDisclaimer3() {
  showModal(`
    <div class="modal-box">
      <div class="modal-title">✍️ Firma Utente Finale</div>
      <div class="modal-text">
        <p>Per poter inviare messaggi è necessario compilare i campi sottostanti. <strong>I messaggi anonimi non sono consentiti.</strong></p>
        <div class="input-group" style="margin-top:14px">
          <label>Firma UF *</label>
          <input type="text" id="sig-input" placeholder="Es. Mario Rossi" value="${escapeHtml(appState.settings.signature || '')}">
        </div>
        <div class="input-group">
          <label>Qualifica (opzionale)</label>
          <input type="text" id="qual-input" placeholder="Es. Avvocato" value="${escapeHtml(appState.settings.qualification || '')}">
        </div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-secondary" onclick="declineDisclaimer()">Annulla</button>
        <button class="modal-btn modal-btn-primary" onclick="acceptDisclaimer3()">Salva e continua</button>
      </div>
    </div>
  `);
}

function acceptDisclaimer1() {
  appState.settings.acceptedDisclaimer1 = true;
  COPZ.saveSettings(appState.settings);
  hideModal();
  showDisclaimer2();
}

function acceptDisclaimer2() {
  appState.settings.acceptedDisclaimer2 = true;
  COPZ.saveSettings(appState.settings);
  hideModal();
  showDisclaimer3();
}

function acceptDisclaimer3() {
  const sig = $('#sig-input').value.trim();
  const qual = $('#qual-input').value.trim();
  if (!sig) {
    alert('La Firma UF è obbligatoria.');
    return;
  }
  appState.settings.signature = sig;
  appState.settings.qualification = qual;
  COPZ.saveSettings(appState.settings);
  hideModal();
  renderCurrentTab();
}

function declineDisclaimer() {
  hideModal();
  $('#tab-content').innerHTML = `
    <div class="empty-state">
      <div class="icon">🚫</div>
      <p>Devi accettare i termini per utilizzare l'app.</p>
      <p style="font-size:13px;color:#8C7B5F;margin-top:8px">Ricarica la pagina per riprovare.</p>
    </div>
  `;
}

// === TAB NAVIGATION ===
function switchTab(tab) {
  appState.currentTab = tab;
  $$('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  renderCurrentTab();
}

function renderCurrentTab() {
  if (!checkDisclaimers()) return;
  if (appState.currentTab === 'today') renderToday();
  else if (appState.currentTab === 'import') renderImport();
  else if (appState.currentTab === 'settings') renderSettings();
}

// === RENDER TODAY ===
function renderToday() {
  const container = $('#tab-content');

  // Carica dati
  try {
    const rawContacts = localStorage.getItem('copz_vcf_data');
    appState.contacts = rawContacts ? JSON.parse(rawContacts) : [];
    const rawNamedays = localStorage.getItem('copz_csv_data');
    appState.namedays = rawNamedays ? JSON.parse(rawNamedays) : [];
  } catch (e) {
    appState.contacts = [];
    appState.namedays = [];
  }

  if (!appState.contacts.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📇</div>
        <p>Nessun contatto importato.</p>
        <p style="font-size:13px;color:#8C7B5F;margin-top:8px">Vai su "Importa" per caricare la tua rubrica.</p>
      </div>
    `;
    return;
  }

  const todayCards = COPZ.buildDailyCards(appState.contacts, appState.namedays, 0);
  const tomorrowCards = COPZ.buildDailyCards(appState.contacts, appState.namedays, 1);
  const yesterdayCards = COPZ.buildDailyCards(appState.contacts, appState.namedays, -1);
  const backlog = COPZ.updateBacklog(appState.contacts, appState.namedays);

  let html = '<div class="tab-header"><h1>🗓️ Oggi</h1>';
  html += '<p class="subtitle">' + formatTodayDate() + '</p></div>';

  // Anti-ban banner
  if (appState.settings.antiBanEnabled) {
    html += `<div class="antiban-banner"><span class="icon">🛡️</span><span><strong>Anti-ban attivo:</strong> ritardo di 2 secondi tra invii consecutivi su Telegram, WhatsApp e SMS.</span></div>`;
  }

  // Toggle solo non inviati
  const totalToday = todayCards.length + backlog.length;
  const sentToday = todayCards.filter(c => c.sent).length + backlog.filter(c => c.sent).length;

  html += `
    <div class="toggle-row">
      <span class="toggle-label">Solo non inviati</span>
      <label class="toggle-switch">
        <input type="checkbox" id="toggle-unsent" ${appState.showOnlyUnsent ? 'checked' : ''} onchange="toggleUnsent()">
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="stats-bar">
      <strong>${sentToday}</strong> / ${totalToday} inviati oggi
    </div>
  `;

  // === IERI (Anticipati) ===
  if (yesterdayCards.length > 0) {
    html += '<div class="section-header">⬅️ Anticipati (Ieri)</div>';
    let shown = 0;
    for (const card of yesterdayCards) {
      if (appState.showOnlyUnsent && card.sent) continue;
      html += renderCard(card);
      shown++;
    }
    if (shown === 0 && appState.showOnlyUnsent) {
      html += '<p style="text-align:center;color:#8C7B5F;font-size:13px;margin:10px 0">Tutti gli anticipati sono stati inviati.</p>';
    }
  }

  // === OGGI: Compleanni ===
  const birthdayCards = todayCards.filter(c => c.displayType === 'birthday');
  if (birthdayCards.length > 0) {
    html += '<div class="section-header">🎂 Compleanni</div>';
    let shown = 0;
    for (const card of birthdayCards) {
      if (appState.showOnlyUnsent && card.sent) continue;
      html += renderCard(card);
      shown++;
    }
    if (shown === 0 && appState.showOnlyUnsent) {
      html += '<p style="text-align:center;color:#8C7B5F;font-size:13px;margin:10px 0">Tutti i compleanni sono stati inviati.</p>';
    }
  }

  // === OGGI: Commemorativi ===
  const commCards = todayCards.filter(c => c.displayType === 'commemorative');
  if (commCards.length > 0) {
    html += '<div class="section-header">🕯️ Commemorativi</div>';
    let shown = 0;
    for (const card of commCards) {
      if (appState.showOnlyUnsent && card.sent) continue;
      html += renderCard(card);
      shown++;
    }
    if (shown === 0 && appState.showOnlyUnsent) {
      html += '<p style="text-align:center;color:#8C7B5F;font-size:13px;margin:10px 0">Tutti i commemorativi sono stati inviati.</p>';
    }
  }

  // === OGGI: Onomastici ===
  const namedayCards = todayCards.filter(c => c.displayType === 'nameday' || c.displayType === 'dual');
  if (namedayCards.length > 0) {
    html += '<div class="section-header">📅 Onomastici</div>';
    let shown = 0;
    for (const card of namedayCards) {
      if (appState.showOnlyUnsent && card.sent) continue;
      html += renderCard(card);
      shown++;
    }
    if (shown === 0 && appState.showOnlyUnsent) {
      html += '<p style="text-align:center;color:#8C7B5F;font-size:13px;margin:10px 0">Tutti gli onomastici sono stati inviati.</p>';
    }
  }

  // === BACKLOG ===
  if (backlog.length > 0) {
    html += '<div class="section-header">⏰ Onomastici non inviati</div>';
    let shown = 0;
    for (const card of backlog) {
      if (appState.showOnlyUnsent && card.sent) continue;
      html += renderCard(card);
      shown++;
    }
    if (shown === 0 && appState.showOnlyUnsent) {
      html += '<p style="text-align:center;color:#8C7B5F;font-size:13px;margin:10px 0">Nessun backlog residuo.</p>';
    }
  }

  // === DOMANI ===
  if (tomorrowCards.length > 0) {
    html += '<div class="section-header">🔜 Domani</div>';
    let shown = 0;
    for (const card of tomorrowCards) {
      if (appState.showOnlyUnsent && card.sent) continue;
      html += renderCard(card);
      shown++;
    }
    if (shown === 0 && appState.showOnlyUnsent) {
      html += '<p style="text-align:center;color:#8C7B5F;font-size:13px;margin:10px 0">Tutti i ricordi di domani sono stati inviati.</p>';
    }
  }

  if (todayCards.length === 0 && tomorrowCards.length === 0 && yesterdayCards.length === 0 && backlog.length === 0) {
    html += `
      <div class="empty-state">
        <div class="icon">🌿</div>
        <p>Nessuna ricorrenza oggi.</p>
        <p style="font-size:13px;color:#8C7B5F;margin-top:8px">Tutto tranquillo, nessun compleanno, onomastico o commemorativo.</p>
      </div>
    `;
  }

  container.innerHTML = html;
}

function formatTodayDate() {
  const d = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return d.toLocaleDateString('it-IT', opts);
}

function toggleUnsent() {
  appState.showOnlyUnsent = $('#toggle-unsent').checked;
  renderToday();
}

function renderCard(card) {
  const c = card.contact;
  const msg = COPZ.buildMessage(c, card.messageType, appState.settings);
  const initials = getInitials(c.fullName);
  const sentClass = card.sent ? 'badge-sent' : 'badge-pending';
  const sentText = card.sent ? 'Confermato' : 'Da inviare';

  let badgeClass = 'badge-nameday';
  if (card.displayType === 'birthday') badgeClass = 'badge-birthday';
  else if (card.displayType === 'commemorative') badgeClass = 'badge-commemorative';
  else if (card.displayType === 'dual') badgeClass = 'badge-dual';
  else if (card.displayType === 'backlog') badgeClass = 'badge-backlog';

  const extraLabel = card.originalDate ? ' — ' + card.originalDate : '';

  let html = `
    <div class="card" data-id="${escapeHtml(c.id)}" data-type="${card.type}" data-datekey="${card.dateKey}">
      <div class="card-header">
        <div class="avatar">${initials}</div>
        <div class="card-info">
          <div class="card-name">${escapeHtml(c.fullName)}</div>
          <div class="card-detail">${escapeHtml(c.phone)}</div>
        </div>
      </div>
      <div class="card-badges">
        <span class="badge ${badgeClass}">${card.label}${extraLabel}</span>
        <span class="badge ${sentClass}">${sentText}</span>
      </div>
      <div class="message-preview">${escapeHtml(msg)}</div>
  `;

  if (!card.sent) {
    html += `
      <div class="action-buttons" id="btns-${escapeHtml(c.id)}-${card.type}">
        <button class="btn-action btn-tg" onclick="initSend('${escapeHtml(c.id)}','${card.type}','${card.dateKey}','tg')" ${appState.antiBanLocked ? 'disabled' : ''}>
          <span>✈️</span><span>Telegram</span>
        </button>
        <button class="btn-action btn-wa" onclick="initSend('${escapeHtml(c.id)}','${card.type}','${card.dateKey}','wa')" ${appState.antiBanLocked ? 'disabled' : ''}>
          <span>💬</span><span>WhatsApp</span>
        </button>
        <button class="btn-action btn-sms" onclick="initSend('${escapeHtml(c.id)}','${card.type}','${card.dateKey}','sms')" ${appState.antiBanLocked ? 'disabled' : ''}>
          <span>📩</span><span>SMS</span>
        </button>
      </div>
    `;
  } else {
    html += `<div style="text-align:center;color:#6B8E6B;font-size:13px;padding:8px 0">✓ Inviato</div>`;
  }

  html += '</div>';
  return html;
}

// === INVIO ===
function initSend(contactId, type, dateKey, platform) {
  if (appState.pendingConfirm) return;

  const cardEl = $(`.card[data-id="${CSS.escape(contactId)}"][data-type="${CSS.escape(type)}"][data-datekey="${CSS.escape(dateKey)}"]`);
  if (!cardEl) return;

  const btns = cardEl.querySelector('.action-buttons');
  if (!btns) return;

  const contact = appState.contacts.find(c => c.id === contactId);
  if (!contact) return;

  const msg = COPZ.buildMessage(contact, type, appState.settings);

  btns.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;font-size:13px;color:#5C4A32;margin-bottom:6px">
      Confermi invio a <strong>${escapeHtml(contact.fullName)}</strong>?
    </div>
    <button class="btn-action btn-confirm" onclick="confirmSend('${escapeHtml(contactId)}','${escapeHtml(type)}','${escapeHtml(dateKey)}','${escapeHtml(platform)}')">✓ Conferma</button>
    <button class="btn-action btn-cancel" onclick="cancelSend('${escapeHtml(contactId)}','${escapeHtml(type)}','${escapeHtml(dateKey)}')">✕ Annulla</button>
  `;

  appState.pendingConfirm = { contactId, type, dateKey };
}

function cancelSend(contactId, type, dateKey) {
  appState.pendingConfirm = null;
  renderToday();
}

function confirmSend(contactId, type, dateKey, platform) {
  appState.pendingConfirm = null;

  const contact = appState.contacts.find(c => c.id === contactId);
  if (!contact) return;

  const msg = COPZ.buildMessage(contact, type, appState.settings);
  const encodedMsg = encodeURIComponent(msg);

  let url = '';
  const phone = contact.phone.replace(/\+/g, '');
  const phonePlus = contact.phone;

  if (platform === 'tg') {
    url = `tg://msg?to=${encodeURIComponent(phonePlus)}&text=${encodedMsg}`;
  } else if (platform === 'wa') {
    url = `https://wa.me/${phone}?text=${encodedMsg}`;
  } else if (platform === 'sms') {
    url = `sms:${phonePlus}?body=${encodedMsg}`;
  }

  window.open(url, '_blank');

  COPZ.markSent(contactId, type, dateKey);

  if (type === 'birthday' || type === 'dual') {
    COPZ.incrementRotationCounter('birthday');
  } else if (type === 'nameday') {
    COPZ.incrementRotationCounter('nameday');
  }

  if (appState.settings.antiBanEnabled) {
    appState.antiBanLocked = true;
    renderToday();
    setTimeout(() => {
      appState.antiBanLocked = false;
      renderToday();
    }, 2000);
  } else {
    renderToday();
  }
}

// === RENDER IMPORT ===
function renderImport() {
  const container = $('#tab-content');

  let html = `
    <div class="tab-header"><h1>⬇️ Importa</h1><p class="subtitle">Carica rubrica e onomastici</p></div>

    <div class="section-header">📇 Rubrica (VCF)</div>
    <div class="import-area" id="vcf-dropzone" onclick="document.getElementById('vcf-input').click()">
      <div class="import-icon">📁</div>
      <div class="import-text">Tocca o trascina qui un file .vcf</div>
      <div class="import-sub">Solo un file per volta. I duplicati vengono sovrascritti.</div>
    </div>
    <input type="file" id="vcf-input" accept=".vcf,.vcard" style="display:none" onchange="handleVcfFile(this.files[0])">
    <div id="vcf-stats" class="stats-bar" style="display:none"></div>

    <div class="section-header">📅 Onomastici (CSV)</div>
    <div class="input-group">
      <label>Codifica file CSV</label>
      <select id="csv-encoding" onchange="saveEncoding()">
        <option value="UTF-8" ${appState.settings.csvEncoding === 'UTF-8' ? 'selected' : ''}>UTF-8</option>
        <option value="ISO-8859-1" ${appState.settings.csvEncoding === 'ISO-8859-1' ? 'selected' : ''}>ISO-8859-1</option>
        <option value="Windows-1252" ${appState.settings.csvEncoding === 'Windows-1252' ? 'selected' : ''}>Windows-1252</option>
      </select>
    </div>
    <div class="import-area" id="csv-dropzone" onclick="document.getElementById('csv-input').click()">
      <div class="import-icon">📄</div>
      <div class="import-text">Tocca o trascina qui un file .csv</div>
      <div class="import-sub">Formato: NOME,GG,MM — una riga per voce</div>
    </div>
    <input type="file" id="csv-input" accept=".csv,.txt" style="display:none" onchange="handleCsvFile(this.files[0])">
    <div id="csv-stats" class="stats-bar" style="display:none"></div>

    <div class="section-header">ℹ️ Info</div>
    <div class="warning-box">
      <span class="icon">💡</span>
      <span>
        <strong>VCF:</strong> esporta la rubrica da iPhone o Android.<br>
        <strong>CSV:</strong> usa il formato <code>NOME,GG,MM</code> (es. <code>MARIA,15,08</code>).<br>
        Solo i contatti con un numero di telefono valido verranno mostrati.
      </span>
    </div>
  `;

  container.innerHTML = html;
  setupDragDrop();

  try {
    const rawC = localStorage.getItem('copz_vcf_data');
    const rawN = localStorage.getItem('copz_csv_data');
    if (rawC) {
      const contacts = JSON.parse(rawC);
      $('#vcf-stats').style.display = 'block';
      $('#vcf-stats').innerHTML = `<strong>${contacts.length}</strong> contatti pronti`;
    }
    if (rawN) {
      const namedays = JSON.parse(rawN);
      $('#csv-stats').style.display = 'block';
      $('#csv-stats').innerHTML = `<strong>${namedays.length}</strong> onomastici caricati`;
    }
  } catch (e) {}
}

function saveEncoding() {
  appState.settings.csvEncoding = $('#csv-encoding').value;
  COPZ.saveSettings(appState.settings);
}

function setupDragDrop() {
  const vcfZone = $('#vcf-dropzone');
  const csvZone = $('#csv-dropzone');
  if (!vcfZone || !csvZone) return;

  [vcfZone, csvZone].forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (zone.id === 'vcf-dropzone' && files.length) handleVcfFile(files[0]);
      if (zone.id === 'csv-dropzone' && files.length) handleCsvFile(files[0]);
    });
  });
}

function handleVcfFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const content = e.target.result;
    const contacts = COPZ.parseVcf(content);
    localStorage.setItem('copz_vcf_data', JSON.stringify(contacts));
    appState.contacts = contacts;
    $('#vcf-stats').style.display = 'block';
    $('#vcf-stats').innerHTML = `<strong>${contacts.length}</strong> contatti pronti`;
    alert(`Importati ${contacts.length} contatti con telefono valido.`);
  };
  reader.readAsText(file);
}

function handleCsvFile(file) {
  if (!file) return;
  const encoding = appState.settings.csvEncoding || 'UTF-8';
  const reader = new FileReader();
  reader.onload = e => {
    const content = e.target.result;
    const namedays = COPZ.parseNamedayCsv(content, encoding);
    localStorage.setItem('copz_csv_data', JSON.stringify(namedays));
    appState.namedays = namedays;
    $('#csv-stats').style.display = 'block';
    $('#csv-stats').innerHTML = `<strong>${namedays.length}</strong> onomastici caricati`;
    alert(`Caricati ${namedays.length} onomastici.`);
  };
  reader.readAsText(file, encoding);
}

// === RENDER SETTINGS ===
function renderSettings() {
  const container = $('#tab-content');
  const s = appState.settings;

  let html = `
    <div class="tab-header"><h1>⚙️ Impostazioni</h1><p class="subtitle">Personalizza mittente e messaggi</p></div>

    <div class="section-header">👤 Mittente</div>
    <div class="input-group">
      <label>Firma UF</label>
      <input type="text" id="set-signature" value="${escapeHtml(s.signature || '')}" placeholder="Mario Rossi">
    </div>
    <div class="input-group">
      <label>Qualifica</label>
      <input type="text" id="set-qualification" value="${escapeHtml(s.qualification || '')}" placeholder="Avvocato">
    </div>

    <div class="section-header">🔒 Sicurezza</div>
    <div class="toggle-row">
      <span class="toggle-label">Ritardo anti-ban (2s)</span>
      <label class="toggle-switch">
        <input type="checkbox" id="set-antiban" ${s.antiBanEnabled ? 'checked' : ''}>
        <span class="toggle-slider"></span>
      </label>
    </div>

    <div class="section-header">🎂 Messaggi Compleanno (3 varianti)</div>
  `;

  for (let i = 0; i < s.birthdayVariants.length; i++) {
    const v = s.birthdayVariants[i];
    html += renderVariantEditor('birthday', i, v, 'Compleanno');
  }

  html += `<div class="section-header">📅 Messaggi Onomastico (5 varianti)</div>`;
  for (let i = 0; i < s.namedayVariants.length; i++) {
    const v = s.namedayVariants[i];
    html += renderVariantEditor('nameday', i, v, 'Onomastico');
  }

  html += `
    <div class="section-header">🕯️ Messaggi Commemorativi</div>
    <div class="variant-editor">
      <div class="input-group">
        <label>Commemorativo Compleanno</label>
        <textarea id="comm-bday">${escapeHtml(s.commemorativeBirthday)}</textarea>
      </div>
      <div class="input-group">
        <label>Commemorativo Onomastico</label>
        <textarea id="comm-nameday">${escapeHtml(s.commemorativeNameday)}</textarea>
      </div>
    </div>

    <div class="section-header">🎂🎉 Messaggi Doppi Auguri (3 varianti)</div>
  `;
  for (let i = 0; i < (s.dualVariants || []).length; i++) {
    const v = s.dualVariants[i];
    html += renderVariantEditor('dual', i, v, 'Doppi auguri');
  }

  html += `
    <div style="height:20px"></div>
    <button class="modal-btn modal-btn-primary" style="width:100%;margin-bottom:10px" onclick="saveAllSettings()">💾 Salva impostazioni</button>
    <button class="modal-btn modal-btn-secondary" style="width:100%;margin-bottom:10px" onclick="resetSettings()">🔄 Ripristina default</button>
    <button class="modal-btn modal-btn-secondary" style="width:100%;margin-bottom:30px" onclick="clearAllData()">🗑️ Cancella tutti i dati</button>
  `;

  container.innerHTML = html;
}

function renderVariantEditor(type, index, variant, label) {
  return `
    <div class="variant-editor">
      <h4>${label} ${index + 1}</h4>
      <div class="variant-parts">
        <div class="variant-part">
          <label>Parte 1</label>
          <input type="text" id="${type}-${index}-p1" value="${escapeHtml(variant.parte1 || '')}" placeholder="Prima parte...">
        </div>
        <div class="variant-part">
          <label>Parte 2</label>
          <input type="text" id="${type}-${index}-p2" value="${escapeHtml(variant.parte2 || '')}" placeholder="Dopo il nome...">
        </div>
        <div class="variant-part">
          <label>Parte 3</label>
          <input type="text" id="${type}-${index}-p3" value="${escapeHtml(variant.parte3 || '')}" placeholder="Chiusura...">
        </div>
      </div>
      <div class="variant-preview">
        Placeholder: <strong>[Nome destinatario]</strong> e <strong>[Firma UF]</strong>
      </div>
    </div>
  `;
}

function saveAllSettings() {
  const s = appState.settings;
  s.signature = $('#set-signature').value.trim();
  s.qualification = $('#set-qualification').value.trim();
  s.antiBanEnabled = $('#set-antiban').checked;

  for (let i = 0; i < s.birthdayVariants.length; i++) {
    s.birthdayVariants[i].parte1 = $(`#birthday-${i}-p1`).value;
    s.birthdayVariants[i].parte2 = $(`#birthday-${i}-p2`).value;
    s.birthdayVariants[i].parte3 = $(`#birthday-${i}-p3`).value;
  }

  for (let i = 0; i < s.namedayVariants.length; i++) {
    s.namedayVariants[i].parte1 = $(`#nameday-${i}-p1`).value;
    s.namedayVariants[i].parte2 = $(`#nameday-${i}-p2`).value;
    s.namedayVariants[i].parte3 = $(`#nameday-${i}-p3`).value;
  }

  s.commemorativeBirthday = $('#comm-bday').value;
  s.commemorativeNameday = $('#comm-nameday').value;

  if (s.dualVariants) {
    for (let i = 0; i < s.dualVariants.length; i++) {
      s.dualVariants[i].parte1 = $(`#dual-${i}-p1`).value;
      s.dualVariants[i].parte2 = $(`#dual-${i}-p2`).value;
      s.dualVariants[i].parte3 = $(`#dual-${i}-p3`).value;
    }
  }

  COPZ.saveSettings(s);
  alert('Impostazioni salvate!');
}

function resetSettings() {
  if (!confirm('Ripristinare tutte le impostazioni ai valori predefiniti?')) return;
  appState.settings = COPZ.getDefaultSettings();
  COPZ.saveSettings(appState.settings);
  renderSettings();
}

function clearAllData() {
  if (!confirm('ATTENZIONE: verranno cancellati TUTTI i dati (rubrica, onomastici, impostazioni, storico invii). Procedere?')) return;
  localStorage.clear();
  appState.contacts = [];
  appState.namedays = [];
  appState.settings = COPZ.getDefaultSettings();
  alert('Tutti i dati cancellati. Ricarica la pagina.');
  location.reload();
}

// === INIT ===
function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const scrollBtn = document.createElement('button');
  scrollBtn.className = 'scroll-top';
  scrollBtn.innerHTML = '↑';
  scrollBtn.onclick = () => $('#tab-content').scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(scrollBtn);

  $('#tab-content').addEventListener('scroll', () => {
    scrollBtn.classList.toggle('visible', $('#tab-content').scrollTop > 300);
  });

  checkDisclaimers();
  if (appState.settings.acceptedDisclaimer1 && appState.settings.acceptedDisclaimer2 && appState.settings.signature) {
    renderCurrentTab();
  }
}

document.addEventListener('DOMContentLoaded', init);
