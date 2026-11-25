// testenv：偽 firebase-app（本物の Firebase には接続しない）
const apps = [];
export function initializeApp(options, name) {
  const app = { name: name || '[DEFAULT]', options: options || {}, automaticDataCollectionEnabled: false, __testenv: true };
  apps.push(app);
  return app;
}
export function getApp(name) { return apps.find(a => a.name === (name || '[DEFAULT]')) || initializeApp({}, name); }
export function getApps() { return apps.slice(); }
export const SDK_VERSION = 'testenv';
