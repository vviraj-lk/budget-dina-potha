import { emptyDiary } from './money.mjs';
import { isLocked } from './vault.mjs';

// The saved diary has two parts. The open part is readable as soon as the diary
// opens. The secure part holds the figures and secret notes, and is the only
// part the diary password encrypts.
const OPEN_KEYS = ['profile', 'contacts', 'reminder'];
const SECURE_KEYS = ['categories', 'entries', 'events', 'budgets', 'accounts', 'balanceUpdates', 'notes'];

function pick(source, keys) {
  const picked = {};
  keys.forEach((key) => {
    if (source && source[key] !== undefined) picked[key] = source[key];
  });
  return picked;
}

// An older save may lack fields that were added later.
function withDefaults(parts) {
  const base = emptyDiary();
  return {
    ...base,
    ...parts,
    profile: { ...base.profile, ...(parts.profile || {}) },
    reminder: { ...base.reminder, ...(parts.reminder || {}) },
  };
}

export function openPart(diary) {
  return pick(diary, OPEN_KEYS);
}

export function securePart(diary) {
  return pick(diary, SECURE_KEYS);
}

export function emptySecurePart() {
  return securePart(emptyDiary());
}

export function toDocument(diary, secure) {
  return { mode: 'split', open: openPart(diary), secure };
}

// Turns a saved document into the diary held in memory. When the secure part is
// encrypted, `lockedPack` carries it untouched and the diary has no figures yet.
// `legacy` marks an older save that encrypted the whole diary in one piece.
export function readDocument(document) {
  if (!document || document.mode === 'empty') return { diary: emptyDiary(), lockedPack: null, legacy: false };
  if (document.mode === 'split') {
    const open = pick(document.open, OPEN_KEYS);
    if (isLocked(document.secure)) return { diary: withDefaults(open), lockedPack: document.secure, legacy: false };
    return { diary: withDefaults({ ...open, ...pick(document.secure, SECURE_KEYS) }), lockedPack: null, legacy: false };
  }
  if (isLocked(document)) return { diary: emptyDiary(), lockedPack: document, legacy: true };
  return { diary: withDefaults(pick(document, [...OPEN_KEYS, ...SECURE_KEYS])), lockedPack: null, legacy: false };
}

// Adds the decrypted figures to the open diary. An older save also kept the
// reminder inside the lock, so it is taken from there once.
export function mergeUnlocked(diary, unlocked, legacy = false) {
  const merged = withDefaults({ ...diary, ...pick(unlocked, SECURE_KEYS) });
  if (legacy && unlocked.reminder) merged.reminder = { ...merged.reminder, ...unlocked.reminder };
  return merged;
}
