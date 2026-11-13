import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const LOCAL_KEY = 'money-diary-local';

function cloudRef(db, uid) {
  return doc(db, 'users', uid, 'diary', 'main');
}

export async function loadDiaryDocument(account) {
  if (account.mode === 'local') {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  const snapshot = await getDoc(cloudRef(account.db, account.uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveDiaryDocument(account, document) {
  if (account.mode === 'local') {
    await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(document));
    return;
  }
  await setDoc(cloudRef(account.db, account.uid), document);
}
