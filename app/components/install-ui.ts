// components/install-ui.ts
import './install-ui.css';

type DeferredPrompt = BeforeInstallPromptEvent | null;

declare global {
  interface Window {
    deferredPWAInstallPrompt?: DeferredPrompt;
  }
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  }
}

const IOS_GUIDE_ID = 'iosInstallGuide';
const ANDROID_GUIDE_ID = 'androidInstallGuide';

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

/* ---------------- iOS Guide ---------------- */

function ensureIOSGuide(): HTMLDivElement {
  let guide = document.getElementById(IOS_GUIDE_ID) as HTMLDivElement | null;
  if (guide) return guide;

  guide = document.createElement('div');
  guide.id = IOS_GUIDE_ID;
  guide.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ios-guide-title">
      <h3 id="ios-guide-title">Add to Home Screen</h3>
      <p>To install this app on iOS Safari, use the “Share” menu:</p>
      <ol>
        <li>Tap the <strong>Share</strong> icon (<ion-icon name="share-outline" style="color:#007AFF;"></ion-icon>)</li>
        <li>Select <strong>Add to Home Screen</strong></li>
        <li>Confirm the name and tap <strong>Add</strong></li>
      </ol>
      <div class="actions">
        <button class="ok" type="button">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(guide);

  const ok = guide.querySelector('.ok') as HTMLButtonElement;
  const hide = () => guide!.setAttribute('data-open', 'false');
  ok.addEventListener('click', hide);
  guide.addEventListener('click', (e) => { if (e.target === guide) hide(); });

  return guide;
}

function showIOSGuide() {
  const guide = ensureIOSGuide();
  guide.setAttribute('data-open', 'true');
}

/* ---------------- Android Guide ---------------- */

function ensureAndroidGuide(): HTMLDivElement {
  let guide = document.getElementById(ANDROID_GUIDE_ID) as HTMLDivElement | null;
  if (guide) return guide;

  guide = document.createElement('div');
  guide.id = ANDROID_GUIDE_ID;
  guide.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="android-guide-title">
      <h3 id="android-guide-title">Install this app</h3>
      <p>You can install this app to your Home screen.</p>
      <ol>
        <li>Open the browser menu (<ion-icon name="ellipsis-vertical-outline"></ion-icon>)</li>
        <li>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong></li>
        <li>Confirm to add/install</li>
      </ol>
      <div class="actions">
        <button class="ok" type="button">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(guide);

  const ok = guide.querySelector('.ok') as HTMLButtonElement;

  const hide = () => guide!.setAttribute('data-open', 'false');

  // “Install now” tries native prompt if available; otherwise just closes.
  ok.addEventListener('click', async () => {
    const dp = window.deferredPWAInstallPrompt;
    if (dp) {
      hide();
      await dp.prompt();
      try { await dp.userChoice; } finally { window.deferredPWAInstallPrompt = null; }
    } else {
      hide();
    }
  });

  // click on backdrop to close
  guide.addEventListener('click', (e) => { if (e.target === guide) hide(); });

  return guide;
}

function showAndroidGuide() {
  const guide = ensureAndroidGuide();
  guide.setAttribute('data-open', 'true');
}

/* ---------------- Capture & Launch ---------------- */

/**
 * Call this once during app bootstrap.
 * It captures the beforeinstallprompt event and stores it globally.
 */
export function setupInstallCapture() {
  const handler = (e: Event) => {
    e.preventDefault();
    window.deferredPWAInstallPrompt = e as BeforeInstallPromptEvent;
  };

  window.removeEventListener('beforeinstallprompt', handler as any);
  window.addEventListener('beforeinstallprompt', handler as any);

  window.addEventListener('appinstalled', () => {
    window.deferredPWAInstallPrompt = null;
  });

  // Prepare guides lazily; ensure elements exist so first open is snappy
  ensureIOSGuide();
  ensureAndroidGuide();
}

/**
 * Trigger from your menu.
 * iOS: show iOS guide.
 * Android:
 *   - if prompt available: show Android guide with "Install now" (pre-prompt)
 *   - else: show Android fallback guide with steps
 * Desktop/others:
 *   - if prompt available: show native prompt
 *   - else: return 'unavailable'
 */
export async function launchInstallFlow(): Promise<'ios-shown' | 'android-shown' | 'accepted' | 'dismissed' | 'unavailable' | 'installed'> {
  if (isStandalone()) return 'installed';

  if (isIOS()) {
    showIOSGuide();
    return 'ios-shown';
  }

  if (isAndroid()) {
    const dp = window.deferredPWAInstallPrompt;
    // Always show the Android guide; it contains an "Install now" button that uses dp if present.
    showAndroidGuide();
    if (dp) return 'android-shown';
    return 'android-shown'; // fallback steps shown
  }

  // Desktop Chrome/Edge, etc.
  const dp = window.deferredPWAInstallPrompt;
  if (!dp) return 'unavailable';

  await dp.prompt();
  const { outcome } = await dp.userChoice;
  window.deferredPWAInstallPrompt = null;
  return outcome; // 'accepted' | 'dismissed'
}
