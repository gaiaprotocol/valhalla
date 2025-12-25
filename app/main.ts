import { chatProfileService } from '@gaiaprotocol/chat-client';
import { createRainbowKit, tokenManager } from '@gaiaprotocol/client-common';
import { BackButtonEvent, setupConfig } from '@ionic/core';
import { defineCustomElements } from '@ionic/core/loader';
import { el } from '@webtaku/el';
import { initializeApp } from 'firebase/app';
import { getMessaging /*, getToken*/ } from 'firebase/messaging';
import Navigo from 'navigo';
import { getAddress } from 'viem';
import { fetchGaiaNames } from './api/gaia-name';
import { fetchGoogleMe, GoogleMe, linkGoogleWeb3Wallet, unlinkGoogleWeb3WalletBySession } from './api/google';
import { fetchMainGodsWithNfts } from './api/main-gods-with-nfts';
import { validateToken } from './auth/validate';
import { showGodModeRequirementDialog } from './components/god-mode-req-alert';
import { hideLoading, showLoading } from './components/loading';
import './main.css';
import { isWebView } from './platform';
import { checkGodMode } from './services/god-mode';
import { createChatView } from './views/authenticated/chat';
import { createDashboardView } from './views/authenticated/dashboard';
import { createLayoutView } from './views/authenticated/layout';
import { createMainMenuView } from './views/authenticated/main-menu';
import { createNoticesView } from './views/authenticated/notices';
import { createGoogleLinkWeb3WalletView } from './views/unauthenticated/google-link-web3-wallet';
import { createLoginView } from './views/unauthenticated/login';
import { View } from './views/view';

// ------------------------------
// Constants & Utilities
// ------------------------------
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD21Q4smrSlTxs-FucpGnW2FX_br1rm0HA',
  authDomain: 'gaia-valhalla.firebaseapp.com',
  projectId: 'gaia-valhalla',
  storageBucket: 'gaia-valhalla.firebasestorage.app',
  messagingSenderId: '797829770593',
  appId: '1:797829770593:web:ac557a31562d0c8bd26920',
  measurementId: 'G-GP4SH06LSL'
} as const;

const ROUTES = {
  ROOT: '/',
  MAIN_MENU: '/main-menu',
  CHAT: '/chat',
  NOTICES: '/notices',
  DASHBOARD: '/dashboard',
  LOGIN: '/login',
  LINK_WALLET: '/google-link-web3-wallet'
} as const;

function safeRemove(view?: View) {
  try { view?.remove(); } catch { /* noop */ }
}

// ------------------------------
// App Shell & Back Button
// ------------------------------
setupConfig({ hardwareBackButton: true, experimentalCloseWatcher: true });

const backHandler = (event: BackButtonEvent) => {
  event.detail.register(0, () => {
    const hasHistory = window.history.length > 1;
    const isFromExternal = document.referrer && !document.referrer.startsWith(window.location.origin);
    if (!hasHistory || isFromExternal) {
      document.removeEventListener('ionBackButton' as any, backHandler);
    }
    window.history.back();
  });
};
document.addEventListener('ionBackButton' as any, backHandler);

defineCustomElements(window);
document.body.appendChild(createRainbowKit());

// ------------------------------
// Notifications (optional)
// ------------------------------
function initFirebaseAndMessaging() {
  const app = initializeApp(FIREBASE_CONFIG);
  let messaging;
  try {
    messaging = getMessaging();
  } catch (err) {
    console.error('Failed to initialize Firebase Messaging', err);
  }
  return { app, messaging };
}

if (!isWebView) {
  initFirebaseAndMessaging();
}

// ------------------------------
// Chat profile hydration
// ------------------------------
chatProfileService.init(async (addresses) => {
  const normalized = addresses.map(getAddress);

  const [names, nfts] = await Promise.all([
    fetchGaiaNames(normalized),
    fetchMainGodsWithNfts(normalized),
  ]);

  const nftMap = new Map<string, { image?: string | null } | null>();
  for (const row of nfts) nftMap.set(getAddress(row.address), row.nft ?? null);

  const result: Record<string, { nickname?: string | null; profileImage?: string | null } | null> = {};
  for (const addr of normalized) {
    const nft = nftMap.get(addr) ?? null;
    const baseNick = names[addr] ?? null;
    const nickname = baseNick ? (baseNick.endsWith('.gaia') ? baseNick : `${baseNick}.gaia`) : null;
    result[addr] = { nickname, profileImage: nft?.image ?? null };
  }

  return result;
});

// ------------------------------
// View/Router orchestration
// ------------------------------
const router = new Navigo('/') as Navigo;

let layoutView: View | undefined;
let currentContentView: View | undefined;
let unauthView: View | undefined;

// 전역 ion-app 컨테이너 (한 번만 생성)
let ionApp: HTMLElement | undefined;

function getIonApp(): HTMLElement {
  if (!ionApp) {
    ionApp = document.createElement('ion-app');
    ionApp.className = 'content-view';
    document.body.appendChild(ionApp);
  }
  return ionApp;
}

function mountContent(content: View) {
  // 레이아웃(모달 컨테이너)이 없으면 생성
  if (!layoutView) {
    layoutView = createLayoutView(router);
    document.body.appendChild(layoutView.el);
  }

  // 기존 컨텐츠 뷰 제거
  safeRemove(currentContentView);

  // ion-app의 기존 컨텐츠 제거하고 새 컨텐츠 추가
  const app = getIonApp();
  app.innerHTML = '';
  app.appendChild(content.el);

  // 참조 저장 (제거용)
  currentContentView = {
    el: content.el,
    remove: () => {
      content.remove();
    }
  };
}

function showAuthed(content: View) {
  safeRemove(unauthView); unauthView = undefined;
  mountContent(content);
}

function showUnauthed(factory: () => View) {
  if (layoutView) { safeRemove(layoutView); layoutView = undefined; }
  safeRemove(currentContentView); currentContentView = undefined;
  safeRemove(unauthView);

  // ion-app 숨기기
  if (ionApp) ionApp.style.display = 'none';

  unauthView = factory();
  document.body.appendChild(unauthView.el);
}

function showAuthedView() {
  // ion-app 표시
  if (ionApp) ionApp.style.display = '';
}

// ------------------------------
// Auth Helpers (single source of truth)
// ------------------------------
async function tryAutoLinkIfNeeded(googleMe: GoogleMe | null): Promise<'ok' | 'to-link' | 'skip'> {
  const walletHasToken = tokenManager.has();

  if (googleMe?.ok && googleMe.wallet_address && googleMe.token) {
    tokenManager.set(googleMe.token, googleMe.wallet_address);
    return 'ok';
  }

  if (googleMe?.ok && !walletHasToken) {
    return 'to-link';
  }

  if (walletHasToken && googleMe?.ok) {
    const authToken = tokenManager.getToken();
    if (!authToken) return 'to-link';
    try {
      const linkRes = await linkGoogleWeb3Wallet(authToken);
      if (linkRes?.ok) {
        if (linkRes.token && linkRes.wallet_address) {
          tokenManager.set(linkRes.token, linkRes.wallet_address);
        } else {
          const refreshed = await fetchGoogleMe();
          if (refreshed.ok && refreshed.token && refreshed.wallet_address) {
            tokenManager.set(refreshed.token, refreshed.wallet_address);
          }
        }
        return 'ok';
      }
      return 'to-link';
    } catch {
      return 'to-link';
    }
  }

  return 'skip';
}

async function determineFlow(): Promise<'ok' | 'to-login' | 'to-link'> {
  let walletHasToken = tokenManager.has();

  let googleMe: GoogleMe | null = null;
  try { googleMe = await fetchGoogleMe(); } catch { googleMe = null; }

  const linkResult = await tryAutoLinkIfNeeded(googleMe);

  walletHasToken = tokenManager.has();

  if (!googleMe?.ok && !walletHasToken) return 'to-login';
  if (linkResult === 'to-link') return 'to-link';

  const valid = await validateToken();
  if (!valid) {
    if (walletHasToken && googleMe?.ok) {
      try { await unlinkGoogleWeb3WalletBySession(); } catch (err) { console.error(err); }
    }
    tokenManager.clear();
    return 'to-login';
  }

  const address = tokenManager.getAddress();
  if (!address) { tokenManager.clear(); return 'to-login'; }

  const hasGodMode = await checkGodMode(address);
  if (!hasGodMode) {
    showGodModeRequirementDialog();
    tokenManager.clear();
    return 'to-login';
  }

  return 'ok';
}

// ------------------------------
// Single Auth Flow (used by ROOT route)
// ------------------------------
async function runAuthFlow() {
  showLoading();
  try {
    const next = await determineFlow();

    if (next === 'to-login') {
      router.navigate(ROUTES.LOGIN);
      return;
    }
    if (next === 'to-link') {
      router.navigate(ROUTES.LINK_WALLET);
      return;
    }

    router.navigate(ROUTES.MAIN_MENU);
  } finally {
    hideLoading();
  }
}

// ------------------------------
// Routes (thin handlers, no duplicated auth)
// ------------------------------
router.on(ROUTES.ROOT, async () => {
  await runAuthFlow();
});

router.on(ROUTES.MAIN_MENU, () => {
  if (!tokenManager.has()) return router.navigate(ROUTES.ROOT);
  showAuthedView();
  const view = createMainMenuView(router);
  showAuthed(view);
});

router.on(ROUTES.CHAT, () => {
  if (!tokenManager.has()) return router.navigate(ROUTES.ROOT);
  showAuthedView();
  const view = createChatView(router);
  showAuthed(view);
});

router.on(ROUTES.NOTICES, () => {
  if (!tokenManager.has()) return router.navigate(ROUTES.ROOT);
  showAuthedView();
  const view = createNoticesView(router);
  showAuthed(view);
});

router.on(ROUTES.DASHBOARD, () => {
  if (!tokenManager.has()) return router.navigate(ROUTES.ROOT);
  showAuthedView();
  const view = createDashboardView(router);
  showAuthed(view);
});

router.on(ROUTES.LOGIN, () => {
  if (tokenManager.has()) return router.navigate(ROUTES.ROOT);
  showUnauthed(() => createLoginView(router));
});

router.on(ROUTES.LINK_WALLET, () => {
  if (tokenManager.has()) return router.navigate(ROUTES.ROOT);
  showUnauthed(() => createGoogleLinkWeb3WalletView(router));
});

router.notFound(() => router.navigate(ROUTES.ROOT));

router.resolve();
