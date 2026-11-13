import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { mergeUnlocked, readDocument, securePart, toDocument } from '../src/document.mjs';
import { addEntry, emptyDiary, setProfile } from '../src/money.mjs';
import { lockDiary, unlockDiary } from '../src/vault.mjs';

const projectId = 'money-diary-local';
let env;

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

test.after(async () => {
  if (env) await env.cleanup();
});

test('the owner can save a diary and another user cannot read it', async () => {
  await env.clearFirestore();
  const owner = env.authenticatedContext('owner').firestore();
  const diary = { mode: 'plain', entries: [{ id: 'salary', amount: 1000, type: 'income', date: '2026-11-02' }] };
  await assertSucceeds(setDoc(doc(owner, 'users/owner/diary/main'), diary));
  const saved = await getDoc(doc(owner, 'users/owner/diary/main'));
  assert.equal(saved.data().entries[0].amount, 1000);

  const other = env.authenticatedContext('other').firestore();
  await assertFails(getDoc(doc(other, 'users/owner/diary/main')));
  await assertFails(setDoc(doc(other, 'users/owner/diary/main'), { mode: 'plain' }));
});

test('with a password, Firestore holds the figures as ciphertext and the profile in the open', async () => {
  await env.clearFirestore();
  const owner = env.authenticatedContext('owner').firestore();
  let diary = setProfile(emptyDiary(), { name: 'Test Person', phone: '+94 77 000 0000' });
  diary = addEntry(diary, { id: 'salary', date: '2026-11-02', type: 'income', amount: 1000, categoryId: 'income-salary', note: 'November salary' });
  const document = toDocument(diary, await lockDiary(securePart(diary), 'correct-password'));
  await assertSucceeds(setDoc(doc(owner, 'users/owner/diary/main'), document));

  const saved = (await getDoc(doc(owner, 'users/owner/diary/main'))).data();
  assert.equal(saved.mode, 'split');
  assert.equal(saved.secure.mode, 'locked');
  assert.equal(JSON.stringify(saved).includes('November salary'), false);

  const opened = readDocument(saved);
  assert.equal(opened.diary.profile.name, 'Test Person');
  assert.equal(opened.diary.entries.length, 0);
  const unlocked = mergeUnlocked(opened.diary, await unlockDiary(opened.lockedPack, 'correct-password'));
  assert.equal(unlocked.entries[0].note, 'November salary');
});
