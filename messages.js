// === MESSAGES ===

function getDefaultSettings() {
  return {
    acceptedDisclaimer1: false,
    acceptedDisclaimer2: false,
    signature: '',
    qualification: '',
    csvEncoding: 'UTF-8',
    antiBanEnabled: true,
    birthdayVariants: [
      { parte1: 'In occasione del tuo compleanno, ', parte2: ', ti auguro ogni bene.', parte3: '' },
      { parte1: 'Tanti auguri per il tuo compleanno, ', parte2: '!', parte3: 'Che sia un anno pieno di soddisfazioni.' },
      { parte1: 'Buon compleanno ', parte2: '!', parte3: 'Un abbraccio virtuale e i migliori auguri.' }
    ],
    namedayVariants: [
      { parte1: 'Buon onomastico, ', parte2: '!', parte3: 'Tanti auguri di buon auspicio.' },
      { parte1: 'In occasione del tuo onomastico, ', parte2: ', auguri sinceri.', parte3: '' },
      { parte1: 'Tanti auguri per il tuo onomastico, ', parte2: '!', parte3: 'Che questa giornata porti serenità.' },
      { parte1: 'Auguri di buon onomastico ', parte2: '!', parte3: 'Un caro saluto.' },
      { parte1: 'Felice onomastico, ', parte2: '!', parte3: 'I migliori auguri per te.' }
    ],
    commemorativeBirthday: 'Anche in occasione del tuo compleanno, [Nome], ti ricordiamo ancora. [Firma].',
    commemorativeNameday: 'Anche in occasione del tuo onomastico, [Nome], ti ricordiamo ancora. [Firma].',
    dualVariants: [
      { parte1: 'Doppi auguri per il tuo compleanno e onomastico, ', parte2: '!', parte3: 'Che sia una giornata speciale.' },
      { parte1: 'Tanti auguri di compleanno e buon onomastico, ', parte2: '!', parte3: 'Ogni bene per te.' },
      { parte1: 'Buon compleanno e buon onomastico ', parte2: '!', parte3: 'Un caro saluto e i migliori auguri.' }
    ]
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('copz_settings');
    if (raw) {
      const saved = JSON.parse(raw);
      const defaults = getDefaultSettings();
      // Merge profondo per array
      return deepMerge(defaults, saved);
    }
  } catch (e) {}
  return getDefaultSettings();
}

function saveSettings(settings) {
  localStorage.setItem('copz_settings', JSON.stringify(settings));
}

function deepMerge(defaults, saved) {
  const result = { ...defaults };
  for (const key in saved) {
    if (saved[key] !== null && typeof saved[key] === 'object' && !Array.isArray(saved[key])) {
      result[key] = deepMerge(defaults[key] || {}, saved[key]);
    } else if (Array.isArray(saved[key]) && Array.isArray(defaults[key])) {
      // Per array di oggetti (varianti), usa saved se ha la giusta lunghezza
      if (saved[key].length === defaults[key].length) {
        result[key] = saved[key];
      } else {
        result[key] = defaults[key].map((def, i) => saved[key][i] ? { ...def, ...saved[key][i] } : def);
      }
    } else {
      result[key] = saved[key];
    }
  }
  return result;
}

function getRotationCounter(type) {
  const key = 'copz_rotation_' + type;
  const raw = localStorage.getItem(key);
  return raw ? parseInt(raw) : 0;
}

function incrementRotationCounter(type) {
  const key = 'copz_rotation_' + type;
  const current = getRotationCounter(type);
  localStorage.setItem(key, String(current + 1));
  return current + 1;
}

function getVariantIndex(type, numVariants) {
  const counter = getRotationCounter(type);
  return counter % numVariants;
}

function buildMessage(contact, type, settings) {
  const sig = settings.signature || '';
  const name = contact.firstName || contact.fullName.split(' ')[0] || 'Amico';

  if (type === 'commemorative_birthday') {
    return settings.commemorativeBirthday
      .replace(/\[Nome\]/gi, name)
      .replace(/\[Firma\]/gi, sig)
      .replace(/\[nome destinatario\]/gi, name)
      .replace(/\[firma uf\]/gi, sig);
  }

  if (type === 'commemorative_nameday') {
    return settings.commemorativeNameday
      .replace(/\[Nome\]/gi, name)
      .replace(/\[Firma\]/gi, sig)
      .replace(/\[nome destinatario\]/gi, name)
      .replace(/\[firma uf\]/gi, sig);
  }

  let variant;
  let vIndex;

  if (type === 'birthday') {
    vIndex = getVariantIndex('birthday', settings.birthdayVariants.length);
    variant = settings.birthdayVariants[vIndex];
  } else if (type === 'nameday') {
    vIndex = getVariantIndex('nameday', settings.namedayVariants.length);
    variant = settings.namedayVariants[vIndex];
  } else if (type === 'dual') {
    vIndex = getVariantIndex('birthday', settings.dualVariants.length);
    variant = settings.dualVariants[vIndex];
  } else {
    return '';
  }

  let msg = '';
  if (variant.parte1) msg += variant.parte1;
  msg += name;
  if (variant.parte2) msg += variant.parte2;
  if (sig) {
    if (variant.parte2 && !variant.parte2.endsWith('.')) msg += ' ';
    msg += ' ' + sig;
  }
  if (variant.parte3) {
    msg += (msg.endsWith('.') || msg.endsWith('!') ? ' ' : '. ');
    msg += variant.parte3;
  }

  // Pulizia spazi multipli
  return msg.replace(/\s+/g, ' ').trim();
}

function markSent(contactId, type, dateKey) {
  const key = 'copz_sent_' + dateKey;
  let sent = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) sent = JSON.parse(raw);
  } catch (e) {}

  // Rimuovi duplicati
  sent = sent.filter(s => !(s.id === contactId && s.type === type));
  sent.push({ id: contactId, type: type, timestamp: Date.now() });
  localStorage.setItem(key, JSON.stringify(sent));
}

window.COPZ = window.COPZ || {};
window.COPZ.getDefaultSettings = getDefaultSettings;
window.COPZ.loadSettings = loadSettings;
window.COPZ.saveSettings = saveSettings;
window.COPZ.buildMessage = buildMessage;
window.COPZ.getVariantIndex = getVariantIndex;
window.COPZ.incrementRotationCounter = incrementRotationCounter;
window.COPZ.markSent = markSent;
