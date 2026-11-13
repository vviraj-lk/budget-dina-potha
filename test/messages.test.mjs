import assert from 'node:assert/strict';
import test from 'node:test';
import { diaryOpenErrorMessage, providerLabel, signInErrorMessage } from '../src/messages.mjs';

const CLOUD = { mode: 'cloud', email: 'someone@example.com' };

test('a closed sign-in window says no account was chosen, for the right provider', () => {
  assert.match(signInErrorMessage({ code: 'auth/popup-closed-by-user' }, 'google'), /No Google account was chosen/);
  assert.match(signInErrorMessage({ code: 'auth/cancelled-popup-request' }, 'microsoft'), /No Microsoft account was chosen/);
  assert.equal(providerLabel('microsoft'), 'Microsoft');
});

test('a sign-in window that cannot report back names the address to open elsewhere', () => {
  const message = signInErrorMessage({ code: 'auth/popup-blocked' }, 'google', 'http://localhost:8081');
  assert.match(message, /could not report back/);
  assert.match(message, /http:\/\/localhost:8081/);
});

test('a provider that is not enabled in Firebase is named', () => {
  assert.match(signInErrorMessage({ code: 'auth/operation-not-allowed' }, 'microsoft'), /Microsoft sign-in is not switched on/);
});

test('an unknown sign-in error keeps its own message', () => {
  assert.equal(signInErrorMessage(new Error('Add the Firebase web config in .env'), 'google'), 'Add the Firebase web config in .env');
});

test('a signed-in diary that cannot be read says the account is signed in and why', () => {
  const missing = diaryOpenErrorMessage({ code: 'unavailable', message: 'Failed to get document because the client is offline.' }, CLOUD);
  assert.match(missing, /signed in as someone@example\.com/);
  assert.match(missing, /create the Firestore database/);
  assert.equal(missing.includes('client is offline'), false);
  assert.match(diaryOpenErrorMessage({ code: 'permission-denied' }, CLOUD), /Firestore rules/);
});

test('a local diary error is passed through unchanged', () => {
  assert.equal(diaryOpenErrorMessage(new Error('Storage is full.'), { mode: 'local', email: '' }), 'Storage is full.');
});
