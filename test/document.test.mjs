import assert from 'node:assert/strict';
import test from 'node:test';
import { emptySecurePart, mergeUnlocked, readDocument, securePart, toDocument } from '../src/document.mjs';
import { addContact, addEntry, addNote, deleteContact, emptyDiary, searchAll, setProfile, setReminder } from '../src/money.mjs';
import { lockDiary, unlockDiary } from '../src/vault.mjs';

function sampleDiary() {
  let diary = setProfile(emptyDiary(), { name: 'Test Person', phone: '+94 77 000 0000' });
  diary = addContact(diary, { id: 'c1', name: 'Fake Plumber', phone: '011 000 0000', note: 'kitchen tap' });
  diary = setReminder(diary, 'weekly', 'someone@example.com', false);
  diary = addEntry(diary, { id: 'salary', date: '2026-11-02', type: 'income', amount: 1000, categoryId: 'income-salary', note: 'November salary' });
  return addNote(diary, { id: 'n1', updatedAt: '2026-11-01', title: 'Locker code', body: 'private' });
}

test('a new diary opens with no password and nothing locked', () => {
  const opened = readDocument(null);
  assert.equal(opened.lockedPack, null);
  assert.deepEqual(opened.diary, emptyDiary());
  assert.equal(readDocument({ mode: 'empty' }).lockedPack, null);
});

test('a password locks only the figures and secret notes', async () => {
  const diary = sampleDiary();
  const saved = toDocument(diary, await lockDiary(securePart(diary), 'correct-password'));
  const text = JSON.stringify(saved);
  assert.equal(text.includes('November salary'), false);
  assert.equal(text.includes('Locker code'), false);
  assert.equal(text.includes('correct-password'), false);
  assert.equal(saved.open.profile.name, 'Test Person');
  assert.equal(saved.open.contacts[0].name, 'Fake Plumber');

  // Opening without the password shows the open part and no figures.
  const opened = readDocument(saved);
  assert.equal(opened.diary.profile.phone, '+94 77 000 0000');
  assert.equal(opened.diary.reminder.interval, 'weekly');
  assert.equal(opened.diary.entries.length, 0);
  assert.equal(opened.diary.notes.length, 0);
  assert.equal(opened.lockedPack.mode, 'locked');

  // A save made while still locked keeps the same ciphertext.
  const changed = setProfile(opened.diary, { name: 'New Name', phone: '' });
  const resaved = toDocument(changed, opened.lockedPack);
  assert.equal(resaved.secure.ciphertext, saved.secure.ciphertext);
  assert.equal(resaved.open.profile.name, 'New Name');

  await assert.rejects(() => unlockDiary(opened.lockedPack, 'wrong-password'), /Wrong password/);
  const unlocked = mergeUnlocked(changed, await unlockDiary(resaved.secure, 'correct-password'));
  assert.equal(unlocked.entries[0].note, 'November salary');
  assert.equal(unlocked.notes[0].title, 'Locker code');
  assert.equal(unlocked.profile.name, 'New Name');
});

test('without a password the whole diary is saved in plain form and reads back', () => {
  const diary = sampleDiary();
  const saved = toDocument(diary, { mode: 'plain', ...securePart(diary) });
  const opened = readDocument(saved);
  assert.equal(opened.lockedPack, null);
  assert.deepEqual(opened.diary, diary);
});

test('an older plain save keeps its figures and gains an empty profile', () => {
  const { profile, contacts, ...older } = sampleDiary();
  const opened = readDocument({ mode: 'plain', ...older });
  assert.equal(opened.lockedPack, null);
  assert.equal(opened.diary.entries[0].amount, 1000);
  assert.equal(opened.diary.reminder.interval, 'weekly');
  assert.deepEqual(opened.diary.profile, { name: '', phone: '' });
  assert.deepEqual(opened.diary.contacts, []);
});

test('an older save that locked the whole diary still unlocks, reminder included', async () => {
  const { profile, contacts, ...older } = sampleDiary();
  const opened = readDocument(await lockDiary(older, 'correct-password'));
  assert.equal(opened.legacy, true);
  assert.equal(opened.diary.entries.length, 0);
  const unlocked = mergeUnlocked(opened.diary, await unlockDiary(opened.lockedPack, 'correct-password'), opened.legacy);
  assert.equal(unlocked.entries[0].note, 'November salary');
  assert.equal(unlocked.reminder.interval, 'weekly');
  assert.deepEqual(unlocked.contacts, []);
});

test('erasing the locked figures keeps the profile and contacts', () => {
  const erased = { ...sampleDiary(), ...emptySecurePart() };
  assert.equal(erased.entries.length, 0);
  assert.equal(erased.notes.length, 0);
  assert.equal(erased.profile.name, 'Test Person');
  assert.equal(erased.contacts.length, 1);
});

test('profile and contacts validate, delete, and appear in search', () => {
  const diary = sampleDiary();
  assert.throws(() => setProfile(diary, { name: 'Test Person', phone: 'call me' }), /phone number/);
  assert.throws(() => addContact(diary, { name: '', phone: '011 000 0000' }), /needs a name/);
  assert.equal(searchAll(diary, [], 'plumber').contacts[0].id, 'c1');
  assert.equal(searchAll(diary, [], '011 000').contacts[0].id, 'c1');
  assert.equal(deleteContact(diary, 'c1').contacts.length, 0);
});
