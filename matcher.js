// === MATCHER ===

function getTargetDate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return { day: d.getDate(), month: d.getMonth() + 1 };
}

function matchBirthdays(contacts, targetDay, targetMonth) {
  return contacts.filter(c => {
    if (!c.birthday) return false;
    return c.birthday.day === targetDay && c.birthday.month === targetMonth;
  });
}

function matchNamedays(contacts, namedaysDb, targetDay, targetMonth) {
  const dayNamedays = namedaysDb.filter(n => n.day === targetDay && n.month === targetMonth);
  if (!dayNamedays.length) return [];

  const dayNames = new Set(dayNamedays.map(n => n.name));
  const results = [];

  for (const c of contacts) {
    // Match su primo e secondo nome (names array)
    const matchedNames = c.names.filter(n => dayNames.has(n));
    if (matchedNames.length > 0) {
      results.push({
        contact: c,
        matchedNames: matchedNames,
        allNamedays: dayNamedays.filter(n => c.names.includes(n.name))
      });
    }
  }

  return results;
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getSentForDate(dateKey) {
  try {
    const raw = localStorage.getItem('copz_sent_' + dateKey);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function isSent(contactId, type, dateKey) {
  const sent = getSentForDate(dateKey);
  return sent.some(s => s.id === contactId && s.type === type);
}

function buildDailyCards(contacts, namedaysDb, offset) {
  const target = getTargetDate(offset);
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + offset);
  const dateKey = formatDateKey(targetDate);

  const cards = [];

  // === COMPLEANNI ===
  // Solo Oggi (0) e Domani (1), MAI Anticipati (-1)
  if (offset >= 0) {
    const birthdays = matchBirthdays(contacts, target.day, target.month);
    for (const c of birthdays) {
      const commemorative = c.isCommemorative;
      // Commemorativi solo in Oggi
      if (commemorative && offset !== 0) continue;

      const type = commemorative ? 'commemorative_birthday' : 'birthday';
      const sent = isSent(c.id, type, dateKey);

      cards.push({
        contact: c,
        type: type,
        displayType: commemorative ? 'commemorative' : 'birthday',
        dateKey: dateKey,
        sent: sent,
        priority: commemorative ? 2 : 1,
        label: commemorative ? 'Commemorativo Compleanno' : 'Compleanno',
        messageType: type
      });
    }
  }

  // === ONOMASTICI ===
  const namedayMatches = matchNamedays(contacts, namedaysDb, target.day, target.month);
  for (const match of namedayMatches) {
    const c = match.contact;
    const commemorative = c.isCommemorative;
    // Commemorativi solo in Oggi
    if (commemorative && offset !== 0) continue;

    const type = commemorative ? 'commemorative_nameday' : 'nameday';
    const sent = isSent(c.id, type, dateKey);

    cards.push({
      contact: c,
      type: type,
      displayType: commemorative ? 'commemorative' : 'nameday',
      dateKey: dateKey,
      sent: sent,
      priority: commemorative ? 2 : 3,
      label: commemorative ? 'Commemorativo Onomastico' : 'Onomastico',
      messageType: type,
      matchedNames: match.matchedNames
    });
  }

  // === DOPPIA RICORRENZA: merge compleanno + onomastico stesso giorno ===
  // Trova contatti che hanno sia compleanno che onomastico oggi (o domani)
  const birthdayIds = new Set(cards.filter(c => c.type === 'birthday').map(c => c.contact.id));
  const namedayIds = new Set(cards.filter(c => c.type === 'nameday').map(c => c.contact.id));
  const dualIds = [...birthdayIds].filter(id => namedayIds.has(id));

  if (dualIds.length > 0) {
    // Rimuovi le card separate e crea card dual
    const filtered = cards.filter(c => {
      if (!dualIds.includes(c.contact.id)) return true;
      return c.type !== 'birthday' && c.type !== 'nameday';
    });

    for (const id of dualIds) {
      const contact = cards.find(c => c.contact.id === id).contact;
      const type = 'dual';
      const sent = isSent(contact.id, type, dateKey);
      filtered.push({
        contact: contact,
        type: type,
        displayType: 'dual',
        dateKey: dateKey,
        sent: sent,
        priority: 1,
        label: 'Compleanno + Onomastico',
        messageType: 'dual'
      });
    }

    // Riordina
    filtered.sort((a, b) => a.priority - b.priority);
    return filtered;
  }

  cards.sort((a, b) => a.priority - b.priority);
  return cards;
}

// === BACKLOG ===
function updateBacklog(contacts, namedaysDb) {
  const today = new Date();
  const backlog = [];
  const seenKeys = new Set();

  // Controlla gli ultimi 30 giorni
  for (let i = 1; i <= 30; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateKey = formatDateKey(checkDate);
    const sent = getSentForDate(dateKey);
    const sentIds = new Set(sent.filter(s => s.type === 'nameday' || s.type === 'commemorative_nameday').map(s => s.id));

    const targetDay = checkDate.getDate();
    const targetMonth = checkDate.getMonth() + 1;
    const matches = matchNamedays(contacts, namedaysDb, targetDay, targetMonth);

    for (const match of matches) {
      const c = match.contact;
      if (c.isCommemorative) continue; // Commemorativi non in backlog
      if (sentIds.has(c.id)) continue;

      const key = c.id + '|' + dateKey;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      backlog.push({
        contact: c,
        type: 'nameday',
        displayType: 'backlog',
        dateKey: dateKey,
        sent: false,
        priority: 4,
        label: 'Onomastico non inviato (' + dateKey + ')',
        messageType: 'nameday',
        matchedNames: match.matchedNames,
        originalDate: dateKey
      });
    }
  }

  return backlog;
}

window.COPZ = window.COPZ || {};
window.COPZ.buildDailyCards = buildDailyCards;
window.COPZ.updateBacklog = updateBacklog;
window.COPZ.getSentForDate = getSentForDate;
window.COPZ.isSent = isSent;
window.COPZ.formatDateKey = formatDateKey;
