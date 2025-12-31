// Minimal service worker - prevents 404 errors
// This service worker intentionally does nothing
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
