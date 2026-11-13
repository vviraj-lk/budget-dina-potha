const ITERATIONS = 120000;

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function deriveKey(password, salt) {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function assertPassword(password) {
  if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters.');
}

export async function lockDiary(diary, password) {
  assertPassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plain = new TextEncoder().encode(JSON.stringify(diary));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return { mode: 'locked', salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(cipher) };
}

export async function unlockDiary(pack, password) {
  try {
    const key = await deriveKey(password, base64ToBytes(pack.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(pack.iv) }, key, base64ToBytes(pack.ciphertext));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    const error = new Error('Wrong password.');
    error.code = 'WRONG_PASSWORD';
    throw error;
  }
}

export function isLocked(document) {
  return document?.mode === 'locked' && typeof document.ciphertext === 'string';
}
