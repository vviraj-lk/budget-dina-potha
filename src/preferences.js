import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_KEY, isTheme } from './theme.mjs';

// Display preferences for this browser. They are kept apart from the diary: they work before sign-in,
// they hold no diary data, and they are never written to the diary document or to Firestore.

// Returns 'light', 'dark', or null when nothing usable is remembered.
export async function loadSavedTheme() {
  const saved = await AsyncStorage.getItem(THEME_KEY);
  return isTheme(saved) ? saved : null;
}

export async function saveTheme(theme) {
  await AsyncStorage.setItem(THEME_KEY, theme);
}
