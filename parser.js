// === PARSER VCF & CSV ===

const TITLES = [
  'sig','sig.','sig.ra','sig.ra.','sig.na','sig.na.','sigg','sigg.',
  'dott','dott.','dott.ssa','dott.ssa.','dottore','dottoressa',
  'ing','ing.','ingegnere','prof','prof.','prof.ssa','prof.ssa.',
  'avv','avv.','avvocato','gen','gen.','generale','col','col.','colonnello',
  'magg','magg.','maggiore','cap','cap.','capitano','ten','ten.','tenente',
  'on','on.','onorevole','sen','sen.','senatore','pres','pres.','presidente',
  'dr','dr.','dr.ssa','dr.ssa.','mr','mr.','mrs','mrs.','ms','ms.','miss',
  'mister','signor','signora','signorina','mons','mons.','monseigneur',
  'don','padre','fratello','suor','suora','madre','card','card.','cardinale',
  'arcivescovo','vescovo','rev','rev.','reverendo','papa','san','santa',
  'beato','beata','cav','cav.','cavaliere','comm','comm.','commendatore',
  'uff','uff.','ufficiale','mar','mar.','marchese','marchesa',
  'cont','cont.','conte','contessa','princ','princ.','principe','principessa',
  'duc','duc.','duca','duchessa','bar','bar.','barone','baronessa',
  'visconte','viscontessa','ingegnere','arch','arch.','architetto',
  'rag','rag.','ragioniere','geom','geom.','geometra','per','per.','perito',
  'commissario','maresciallo','brigadiere','appuntato','carabiniere',
  'agente','sovrintendente','ispettore','questore','prefetto','ministro',
  'ambasciatore','console','delegato','segretario','direttore','dirigente',
  'coordinatore','responsabile','titolare','fondatore','socio'
];

function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function removeTitles(str) {
  if (!str) return '';
  let result = str;
  // Ordina per lunghezza decrescente per evitare match parziali
  const sortedTitles = [...TITLES].sort((a,b) => b.length - a.length);
  for (const title of sortedTitles) {
    const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\./g, '\\.?');
    const re = new RegExp('\\b' + esc + '\\b', 'gi');
    result = result.replace(re, '');
  }
  return result.replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizePhone(tel) {
  if (!tel) return null;
  let cleaned = String(tel).replace(/[\s\-\.\(\)]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.substring(2);
  // Assume italiano
  if (cleaned.startsWith('3') || cleaned.startsWith('0')) return '+39' + cleaned;
  return '+' + cleaned;
}

function parseVcfDate(bdayStr) {
  if (!bdayStr) return null;
  const s = String(bdayStr).trim();
  // YYYY-MM-DD
  let m = s.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (m) return { day: parseInt(m[2]), month: parseInt(m[1]) };
  // --MM-DD
  m = s.match(/^--(\d{2})-(\d{2})$/);
  if (m) return { day: parseInt(m[2]), month: parseInt(m[1]) };
  // YYYYMMDD
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return { day: parseInt(m[3]), month: parseInt(m[2]) };
  // DD-MM-YYYY o DD/MM/YYYY
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return { day: parseInt(m[1]), month: parseInt(m[2]) };
  // MM-DD o MM/DD
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return { day: parseInt(m[2]), month: parseInt(m[1]) };
  // DD.MM.YYYY
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return { day: parseInt(m[1]), month: parseInt(m[2]) };
  return null;
}

function extractProperNames(fullName, structuredName) {
  let firstName = '';
  let lastName = '';

  if (structuredName) {
    const parts = structuredName.split(';');
    lastName = (parts[0] || '').trim();
    firstName = (parts[1] || '').trim();
  }

  if (!firstName && fullName) {
    // Prova a dedurre: prima parola = nome, resto = cognome
    const clean = removeTitles(fullName);
    const parts = clean.split(/\s+/).filter(p => p.length > 1);
    if (parts.length >= 1) firstName = parts[0];
    if (parts.length >= 2) lastName = parts.slice(1).join(' ');
  }

  const cleanFirst = removeTitles(firstName);
  const cleanLast = removeTitles(lastName);

  const firstNames = cleanFirst.split(/\s+/)
    .map(p => removeAccents(p).toLowerCase().replace(/[^a-z]/g, ''))
    .filter(p => p.length >= 2);

  const lastNames = cleanLast.split(/\s+/)
    .map(p => removeAccents(p).toLowerCase().replace(/[^a-z]/g, ''))
    .filter(p => p.length >= 2);

  return { firstNames, lastNames, rawFirst: firstName, rawLast: lastName };
}

function isCommemorative(firstName, lastName) {
  const check = (str) => {
    if (!str) return false;
    const clean = removeAccents(str).toLowerCase();
    return /\bmorto\b/.test(clean) || /\bmorta\b/.test(clean);
  };
  return check(firstName) || check(lastName);
}

function parseVcf(content) {
  const contacts = [];
  const cards = content.split(/BEGIN:VCARD/i).slice(1);

  for (const card of cards) {
    const endIdx = card.search(/END:VCARD/i);
    if (endIdx === -1) continue;
    const body = card.substring(0, endIdx);

    // Gestione continuation lines
    const lines = body.split(/\r?\n/).reduce((acc, line) => {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (acc.length) acc[acc.length - 1] += line.substring(1);
      } else {
        acc.push(line);
      }
      return acc;
    }, []);

    let fn = '', n = '', bday = '', note = '';
    const tels = [];

    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.startsWith('FN')) {
        const idx = line.indexOf(':');
        if (idx !== -1) fn = line.substring(idx + 1).trim();
      } else if (upper.startsWith('N') && !upper.startsWith('NOTE')) {
        const idx = line.indexOf(':');
        if (idx !== -1) n = line.substring(idx + 1).trim();
      } else if (upper.startsWith('BDAY')) {
        const idx = line.indexOf(':');
        if (idx !== -1) bday = line.substring(idx + 1).trim();
      } else if (upper.startsWith('TEL')) {
        const idx = line.indexOf(':');
        if (idx !== -1) {
          const tel = line.substring(idx + 1).trim();
          if (tel) tels.push(tel);
        }
      } else if (upper.startsWith('NOTE')) {
        const idx = line.indexOf(':');
        if (idx !== -1) note = line.substring(idx + 1).trim();
      }
    }

    // Se FN manca ma N c'è, ricostruisci
    if (!fn && n) {
      const np = n.split(';');
      const parts = [];
      if (np[1]) parts.push(np[1]);
      if (np[2]) parts.push(np[2]);
      if (np[0]) parts.push(np[0]);
      fn = parts.join(' ').trim();
    }

    if (!fn) continue;

    const phone = tels.map(normalizePhone).find(p => p !== null);
    if (!phone) continue; // Solo contatti con telefono valido

    const names = extractProperNames(fn, n);
    const bdayObj = parseVcfDate(bday);
    const commemorative = isCommemorative(names.rawFirst, names.rawLast);

    const contact = {
      id: (removeAccents(fn).toLowerCase().replace(/[^a-z0-9]/g, '') + '|' + phone.replace(/\D/g, '')),
      fullName: fn,
      firstName: names.rawFirst,
      lastName: names.rawLast,
      names: names.firstNames,
      allNames: [...names.firstNames, ...names.lastNames],
      phone: phone,
      rawPhones: tels,
      birthday: bdayObj,
      note: note,
      isCommemorative: commemorative,
      isCommemorativeByName: commemorative
    };

    contacts.push(contact);
  }

  return contacts;
}

function parseNamedayCsv(content, encoding) {
  const namedays = [];
  const seen = new Set();

  // Decodifica se necessario (il file è già stringa se letto come text,
  // ma per encoding diverso da UTF-8 usiamo FileReader in app.js)
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith('nome')) continue;

    const parts = trimmed.split(',');
    if (parts.length < 3) continue;

    const name = removeAccents(parts[0].trim()).toLowerCase().replace(/[^a-z]/g, '');
    const day = parseInt(parts[1].trim());
    const month = parseInt(parts[2].trim());

    if (!name || isNaN(day) || isNaN(month)) continue;
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;

    const key = name + '|' + day + '|' + month;
    if (seen.has(key)) continue;
    seen.add(key);

    namedays.push({ name, day, month });
  }

  return namedays;
}

// Esporta per uso globale
window.COPZ = window.COPZ || {};
window.COPZ.parseVcf = parseVcf;
window.COPZ.parseNamedayCsv = parseNamedayCsv;
window.COPZ.normalizePhone = normalizePhone;
window.COPZ.removeAccents = removeAccents;
window.COPZ.removeTitles = removeTitles;
