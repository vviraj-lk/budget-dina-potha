import assert from 'node:assert/strict';
import test from 'node:test';
import { PALETTES, THEME_KEY, isTheme, otherTheme, resolveTheme, themeButtonLabel } from '../src/theme.mjs';

// WCAG contrast ratio between two `#RRGGBB` colours. 1 is no contrast, 21 is black on white.
function luminance(hex) {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// [text colour, background colour] as the screens use them. Each must reach 4.5, the usual mark for body text.
const READING_PAIRS = [
  ['text', 'page'],
  ['text', 'surface'],
  ['text', 'control'],
  ['text', 'highlight'],
  ['text', 'holidayBg'],
  ['textBody', 'page'],
  ['textBody', 'surface'],
  ['textBody', 'control'],
  ['textHint', 'page'],
  ['textHint', 'surface'],
  ['error', 'page'],
  ['error', 'surface'],
  ['accentText', 'surface'],
  ['bannerText', 'bannerBg'],
  ['bannerText', 'page'],
  ['holidayMark', 'surface'],
  ['holidayMark', 'holidayBg'],
  ['headerTitle', 'headerBg'],
  ['headerText', 'headerBg'],
  ['headerKicker', 'headerBg'],
  ['headerButtonText', 'headerButtonBg'],
];

// Bold labels on the orange accent, and the accent as an outline, need 3. Light mode keeps the colours it always had.
const BOLD_PAIRS = [
  ['onAccent', 'accent'],
  ['accent', 'surface'],
  ['accent', 'page'],
];

test('both palettes define exactly the same colour names', () => {
  assert.deepEqual(Object.keys(PALETTES).sort(), ['dark', 'light']);
  assert.deepEqual(Object.keys(PALETTES.dark).sort(), Object.keys(PALETTES.light).sort());
  for (const palette of Object.values(PALETTES)) {
    for (const [name, colour] of Object.entries(palette)) {
      assert.match(colour, name === 'backdrop' ? /^rgba\(\d+,\d+,\d+,0?\.\d+\)$/ : /^#[0-9A-F]{6}$/, name);
    }
  }
});

test('text stays readable against its background in light and in dark', () => {
  for (const [themeName, palette] of Object.entries(PALETTES)) {
    for (const [text, background] of READING_PAIRS) {
      const ratio = contrast(palette[text], palette[background]);
      assert.ok(ratio >= 4.5, `${themeName}: ${text} on ${background} is ${ratio.toFixed(2)}, below 4.5`);
    }
    for (const [text, background] of BOLD_PAIRS) {
      const ratio = contrast(palette[text], palette[background]);
      assert.ok(ratio >= 3, `${themeName}: ${text} on ${background} is ${ratio.toFixed(2)}, below 3`);
    }
  }
  // Dark mode is new, so its placeholder and button labels are held to the full mark as well.
  assert.ok(contrast(PALETTES.dark.placeholder, PALETTES.dark.surface) >= 4.5);
  assert.ok(contrast(PALETTES.dark.onAccent, PALETTES.dark.accent) >= 4.5);
});

test('dark mode is dark and light mode is light', () => {
  assert.ok(luminance(PALETTES.dark.page) < 0.05);
  assert.ok(luminance(PALETTES.dark.surface) < 0.05);
  assert.ok(luminance(PALETTES.light.page) > 0.9);
  assert.ok(luminance(PALETTES.light.surface) > 0.9);
});

test('the remembered choice wins over the device setting', () => {
  assert.equal(resolveTheme('dark', 'light'), 'dark');
  assert.equal(resolveTheme('light', 'dark'), 'light');
  assert.equal(resolveTheme('dark', null), 'dark');
});

test('with nothing usable remembered, the device setting is followed, then light', () => {
  assert.equal(resolveTheme(null, 'dark'), 'dark');
  assert.equal(resolveTheme(undefined, 'light'), 'light');
  assert.equal(resolveTheme('', 'dark'), 'dark');
  assert.equal(resolveTheme('purple', 'dark'), 'dark');
  assert.equal(resolveTheme('DARK', 'light'), 'light');
  assert.equal(resolveTheme(null, null), 'light');
  assert.equal(resolveTheme(null, undefined), 'light');
  assert.equal(resolveTheme('purple', 'unspecified'), 'light');
  assert.equal(isTheme('dark'), true);
  assert.equal(isTheme('purple'), false);
});

test('the button flips between the two themes and names the one it will switch to', () => {
  assert.equal(otherTheme('light'), 'dark');
  assert.equal(otherTheme('dark'), 'light');
  assert.equal(otherTheme(otherTheme('dark')), 'dark');
  assert.equal(themeButtonLabel('light'), 'Dark mode');
  assert.equal(themeButtonLabel('dark'), 'Light mode');
});

test('the remembered choice has its own storage key, apart from the diary', () => {
  assert.equal(THEME_KEY, 'money-diary-theme');
  assert.notEqual(THEME_KEY, 'money-diary-local');
});
