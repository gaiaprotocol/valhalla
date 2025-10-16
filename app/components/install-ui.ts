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

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isStandalone(): boolean {
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

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
        <li>Tap the <strong>Share</strong> icon (⬆️)</li>
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
  guide.addEventListener('click', (e) => {
    if (e.target === guide) hide();
  });

  return guide;
}

function showIOSGuide() {
  const guide = ensureIOSGuide();
  guide.setAttribute('data-open', 'true');
}

/**
 * Call this once during app bootstrap.
 * It captures the beforeinstallprompt event and stores it globally.
 */
export function setupInstallCapture() {
  // Avoid duplicate listeners in HMR/dev
  const handler = (e: Event) => {
    e.preventDefault();
    window.deferredPWAInstallPrompt = e as BeforeInstallPromptEvent;
  };

  window.removeEventListener('beforeinstallprompt', handler as any);
  window.addEventListener('beforeinstallprompt', handler as any);

  window.addEventListener('appinstalled', () => {
    window.deferredPWAInstallPrompt = null;
  });

  // Ensure iOS guide exists (created lazily if needed)
  ensureIOSGuide();
}

/**
 * Triggered by your menu item.
 * - On iOS: opens the guide
 * - On Chrome/Edge: shows native install prompt if available
 * Returns the outcome for telemetry if you want it.
 */
export async function launchInstallFlow(): Promise<'ios-shown' | 'accepted' | 'dismissed' | 'unavailable' | 'installed'> {
  if (isStandalone()) return 'installed';

  if (isIOS()) {
    showIOSGuide();
    return 'ios-shown';
  }

  const dp = window.deferredPWAInstallPrompt;
  if (!dp) {
    // Optional: replace with your toast/alert component
    // e.g., showToast('Install not available yet. Try visiting this page directly in your browser.');
    return 'unavailable';
  }

  await dp.prompt();
  const { outcome } = await dp.userChoice;
  window.deferredPWAInstallPrompt = null;
  return outcome; // 'accepted' | 'dismissed'
}
