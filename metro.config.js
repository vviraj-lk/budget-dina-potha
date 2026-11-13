const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Google's sign-in window only returns the chosen account when this page
// sends the same popup policy. Set it on every dev-server response.
const originalWriteHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function writeHeadWithPopupPolicy(...args) {
  if (!this.headersSent) {
    this.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  }
  return originalWriteHead.apply(this, args);
};

module.exports = config;
