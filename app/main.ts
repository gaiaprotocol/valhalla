import { chatProfileService } from '@gaiaprotocol/chat-client';
import { createRainbowKit, tokenManager } from '@gaiaprotocol/client-common';
import { BackButtonEvent, setupConfig } from '@ionic/core';
import { defineCustomElements } from '@ionic/core/loader';
import { initializeApp } from 'firebase/app';
import { getMessaging /*, getToken*/ } from 'firebase/messaging';
import Navigo from 'navigo';
import { getAddress } from 'viem';
import { fetchGaiaNames } from './api/gaia-name';
import { fetchGoogleMe, GoogleMe, linkGoogleWeb3Wallet, unlinkGoogleWeb3WalletBySession } from './api/google';
import { fetchMainGodsWithNfts } from './api/main-gods-with-nfts';
import { validateToken } from './auth/validate';
import { showGodModeRequirementDialog } from './components/god-mode-req-alert';
import './main.css';
import { isWebView } from './platform';
import { checkGodMode } from './services/god-mode';
import { createHomeView } from './views/authenticated/home';
import { createLayoutView } from './views/authenticated/layout';
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
  LOGIN: '/login',
  LINK_WALLET: '/google-link-web3-wallet'
} as const;

function safeRemove(view?: View) {
  try { view?.remove(); } catch { /* noop */ }
}

function bySel<T extends Element = HTMLElement>(root: ParentNode, sel: string) {
  return root.querySelector(sel) as T | null;
}

// Debounce utility for small UI niceties
function debounce<T extends (...args: any[]) => void>(fn: T, ms = 100) {
  let t: number | undefined;
  return ((...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  }) as T;
}

// ------------------------------
// App Shell & Back Button
// ------------------------------
setupConfig({ hardwareBackButton: true, experimentalCloseWatcher: true });

document.addEventListener('ionBackButton' as any, (event: BackButtonEvent) => {
  event.detail.register(0, () => window.history.back());
});

defineCustomElements(window);
document.body.appendChild(createRainbowKit());

// ------------------------------
// Notifications (optional)
// ------------------------------
function initFirebaseAndMessaging() {
  const app = initializeApp(FIREBASE_CONFIG);
  const messaging = getMessaging(app);
  return { app, messaging };
}

async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    return await Notification.requestPermission();
  } catch {
    // Fallback for older browsers just in case
    return new Promise((resolve) => {
      Notification.requestPermission((perm: NotificationPermission) => resolve(perm));
    });
  }
}

// // Uncomment when you are ready to fetch FCM tokens
// async function maybeEnablePush(messaging: ReturnType<typeof getMessaging>) {
//   const permission = await requestNotificationPermission();
//   if (permission === 'granted') {
//     const token = await getToken(messaging, { vapidKey: 'BGPXUkzHHkFCCnB0qvuEkj3VtJ3eK8z71PvYTorx4xRq9lBaY9BE4knxb1i13Qn49nogLJX9B1zOoX-Gvaj5TjI' });
//     console.log('[FCM] token', token);
//   } else {
//     console.log('[FCM] permission denied:', permission);
//   }
// }

if (!isWebView) {
  // Lazy init; keep side-effects minimal
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
let contentContainer: HTMLElement | undefined;
let unauthView: View | undefined; // login or link-wallet

const scrollBottomSoon = debounce(() => {
  try {
    const home = bySel<HTMLElement>(document, '[data-home-root]');
    home?.scrollTo({ top: home.scrollHeight });
  } catch {/* noop */ }
}, 100);

function mountContent(content: View) {
  if (!layoutView) {
    layoutView = createLayoutView(router);
    contentContainer = bySel<HTMLElement>(layoutView.el, '.content')!;
    contentContainer.appendChild(content.el);
    document.body.appendChild(layoutView.el);
  } else {
    contentContainer!.replaceChildren(content.el);
  }
}

function showAuthed(content: View) {
  safeRemove(unauthView); unauthView = undefined;
  mountContent(content);
}

function showUnauthed(factory: () => View) {
  if (layoutView) { safeRemove(layoutView); layoutView = undefined; contentContainer = undefined; }
  safeRemove(unauthView);
  unauthView = factory();
  document.body.appendChild(unauthView.el);
}

// ------------------------------
// Loading Overlay (ion-spinner)
// ------------------------------
let loadingEl: HTMLElement | null = null;

function showLoading() {
  if (loadingEl) return;
  loadingEl = document.createElement('div');
  loadingEl.setAttribute('data-loading-overlay', '');
  Object.assign(loadingEl.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'color-mix(in oklab, var(--ion-background-color, #fff) 70%, transparent)',
    zIndex: '2147483647',
  } as CSSStyleDeclaration);
  loadingEl.innerHTML = `<ion-spinner name="crescent" style="width:48px;height:48px"></ion-spinner>`;
  document.body.appendChild(loadingEl);
}

function hideLoading() {
  try { loadingEl?.remove(); } catch { /* noop */ }
  loadingEl = null;
}

// ------------------------------
// Auth Helpers (single source of truth)
// ------------------------------
async function tryAutoLinkIfNeeded(googleMe: GoogleMe | null): Promise<'ok' | 'to-link' | 'skip'> {
  const walletHasToken = tokenManager.has();

  // (3) 구글 로그인 X && tokenManager X => 로그인 필요
  if (!googleMe?.ok && !walletHasToken) return 'skip';

  // (2) 구글 로그인 O && 링크 안됨 && tokenManager X => 링크 필요
  if (googleMe?.ok && (!googleMe.wallet_address || !googleMe.token) && !walletHasToken) return 'to-link';

  // (1) tokenManager O && 구글 로그인 O => 자동 링크 시도 가능
  if (walletHasToken && googleMe?.ok) {
    if (googleMe.wallet_address && googleMe.token) {
      tokenManager.set(googleMe.token, googleMe.wallet_address);
      return 'ok';
    }
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
  // 0) 현재 지갑 토큰/주소 상태
  const walletHasToken = tokenManager.has();

  // 1) Google 세션 상태
  let googleMe: GoogleMe | null = null;
  try { googleMe = await fetchGoogleMe(); } catch { googleMe = null; }

  // 2) 자동 링크/분기
  const linkResult = await tryAutoLinkIfNeeded(googleMe);
  if (!googleMe?.ok && !walletHasToken) return 'to-login';
  if (linkResult === 'to-link') return 'to-link';

  // 3) 최종 세션 검증 + God Mode
  const valid = await validateToken();
  if (!valid) {
    // googleMe가 존재하지만 토큰이 유효하지 않은 경우 언링크
    if (googleMe?.ok) {
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

    // ok
    const view = createHomeView();
    showAuthed(view);
    // Scroll bottom twice (layout settle + content paint)
    scrollBottomSoon();
    window.setTimeout(scrollBottomSoon, 120);
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

router.on(ROUTES.LOGIN, () => {
  // 이미 인증 완료 상태면 루트로
  if (tokenManager.has()) return router.navigate(ROUTES.ROOT);
  showUnauthed(() => createLoginView(router));
});

router.on(ROUTES.LINK_WALLET, () => {
  if (tokenManager.has()) return router.navigate(ROUTES.ROOT);
  showUnauthed(() => createGoogleLinkWeb3WalletView(router));
});

router.notFound(() => router.navigate(ROUTES.ROOT));

router.resolve();
