const PROVIDER_LABELS = { google: 'Google', microsoft: 'Microsoft' };

export function providerLabel(providerName) {
  return PROVIDER_LABELS[providerName] || 'Google';
}

// What to tell the user when the separate sign-in window does not return an account.
export function signInErrorMessage(error, providerName, pageAddress = '') {
  const label = providerLabel(providerName);
  switch (error?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return `No ${label} account was chosen. Press the button again and pick an account in the window that opens.`;
    case 'auth/popup-blocked':
      return `The ${label} sign-in window could not report back to this page. Allow pop-ups for this site, then try again. The preview browser inside Cursor cannot finish sign-in, so open ${pageAddress || 'this address'} in Chrome or Edge instead.`;
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return `${label} sign-in is not switched on in the Firebase project yet. Enable it under Authentication, Sign-in method.`;
    case 'auth/unauthorized-domain':
      return 'This web address is not allowed in Firebase Authentication. Add it under Authentication, Settings, Authorized domains.';
    case 'auth/web-storage-unsupported':
      return 'This browser is blocking the storage sign-in needs. Allow site data for this page, then try again.';
    case 'auth/network-request-failed':
      return `Sign-in could not reach ${label}. Check the internet connection, then try again.`;
    default:
      return error?.message || 'Sign-in failed.';
  }
}

// What to tell the user when sign-in worked but the saved diary could not be read.
export function diaryOpenErrorMessage(error, account) {
  if (account?.mode !== 'cloud') return error?.message || 'The diary could not be opened.';
  const signedIn = `You are signed in as ${account.email}, but`;
  if (error?.code === 'unavailable') {
    return `${signedIn} the online diary could not be reached. Check the internet connection. In a new Firebase project, create the Firestore database first.`;
  }
  if (error?.code === 'permission-denied') {
    return `${signedIn} the Firestore rules do not let this account open its diary. Publish the rules in firestore.rules to the Firebase project.`;
  }
  return `${signedIn} the online diary could not be opened. ${error?.message || ''}`.trim();
}
