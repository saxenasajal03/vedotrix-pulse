import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initNotificationsOnStartup } from './lib/deviceNotifications';

// Initialize device notifications & register service worker
initNotificationsOnStartup().catch(() => {});

// Register service worker for device notifications & PWA
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', window.location.href).href;
    navigator.serviceWorker.register(swUrl).catch((err) => {
      console.log('SW registration note:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
