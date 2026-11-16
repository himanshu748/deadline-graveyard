// Browser glue for reminders (capture-and-export R3.1, R3.3, R3.4). MDN references:
// https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static
// https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
// There is no push server: reminders fire only while a tab of the app is open.

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface Notifier {
  permission(): PermissionState;
  /** R3.1: call only from the click that turns reminders on. */
  request(): Promise<PermissionState>;
  show(title: string, body: string, tag: string): Promise<void>;
}

export const SW_URL = '/sw.js';

function hasNotification(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registers public/sw.js once. Resolves to null where service workers are unavailable. */
function serviceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registration) return registration;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null);
  registration = navigator.serviceWorker
    .register(SW_URL)
    .then(() => navigator.serviceWorker.ready)
    .catch(() => null);
  return registration;
}

export const browserNotifier: Notifier = {
  permission() {
    return hasNotification() ? Notification.permission : 'unsupported';
  },
  async request() {
    if (!hasNotification()) return 'unsupported';
    const result = await Notification.requestPermission();
    if (result === 'granted') void serviceWorker();
    return result;
  },
  async show(title, body, tag) {
    if (!hasNotification() || Notification.permission !== 'granted') return;
    const reg = await serviceWorker();
    // Prefer the service worker (registration.showNotification, as in MDN's example); the page
    // constructor is only a fallback where no service worker could be registered.
    if (reg) {
      await reg.showNotification(title, { body, tag });
      return;
    }
    new Notification(title, { body, tag });
  },
};
