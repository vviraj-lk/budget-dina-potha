// Light and dark colours for the whole app, and the small rules for choosing between them.
// The choice is a display preference for this browser. It is not part of the diary.

export const THEME_KEY = 'money-diary-theme';

// Both palettes must define the same names. Components never write a colour themselves.
export const PALETTES = {
  light: {
    page: '#F8FAFC',
    surface: '#FFFFFF',
    control: '#E2E8F0',
    border: '#E2E8F0',
    inputBorder: '#CBD5E1',
    divider: '#F1F5F9',
    text: '#0F172A',
    textBody: '#334155',
    textHint: '#64748B',
    placeholder: '#94A3B8',
    error: '#B91C1C',
    accent: '#D97706',
    onAccent: '#FFFFFF',
    accentText: '#B45309',
    highlight: '#FEF3C7',
    bannerBg: '#FEF3C7',
    bannerText: '#92400E',
    holidayBg: '#ECFDF5',
    holidayMark: '#047857',
    headerBg: '#1E293B',
    headerKicker: '#FDE68A',
    headerTitle: '#FFFFFF',
    headerText: '#E2E8F0',
    headerButtonBg: '#334155',
    headerButtonText: '#F8FAFC',
    backdrop: 'rgba(15,23,42,0.45)',
  },
  dark: {
    page: '#0F172A',
    surface: '#1E293B',
    control: '#334155',
    border: '#334155',
    inputBorder: '#475569',
    divider: '#334155',
    text: '#F1F5F9',
    textBody: '#CBD5E1',
    textHint: '#94A3B8',
    placeholder: '#8492A6',
    error: '#FCA5A5',
    accent: '#F59E0B',
    onAccent: '#0F172A',
    accentText: '#FBBF24',
    highlight: '#4A3207',
    bannerBg: '#4A3207',
    bannerText: '#FCD34D',
    holidayBg: '#064E3B',
    holidayMark: '#6EE7B7',
    headerBg: '#1E293B',
    headerKicker: '#FDE68A',
    headerTitle: '#FFFFFF',
    headerText: '#E2E8F0',
    headerButtonBg: '#334155',
    headerButtonText: '#F8FAFC',
    backdrop: 'rgba(2,6,23,0.7)',
  },
};

export function isTheme(value) {
  return value === 'light' || value === 'dark';
}

// The remembered choice wins. With nothing remembered, follow the device. Failing both, light.
export function resolveTheme(saved, device) {
  if (isTheme(saved)) return saved;
  if (isTheme(device)) return device;
  return 'light';
}

export function otherTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}

// The button says what pressing it will do.
export function themeButtonLabel(theme) {
  return otherTheme(theme) === 'dark' ? 'Dark mode' : 'Light mode';
}
