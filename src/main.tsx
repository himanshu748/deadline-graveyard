import { render } from 'preact';
import { App } from './ui/App.tsx';
import './styles.css';

const root = document.getElementById('app');
if (!root) {
  throw new Error('Missing #app root element');
}
render(<App />, root);

// Cache the built shell without asking for notification permission. Only HTTPS/localhost supports SW.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').catch(() => {
    const notice = document.createElement('p');
    notice.className = 'notice';
    notice.setAttribute('role', 'status');
    notice.textContent = 'Offline loading is unavailable in this browser. Keep this tab open or reconnect before reloading.';
    document.body.append(notice);
  });
}
