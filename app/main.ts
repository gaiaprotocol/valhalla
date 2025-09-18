import { chatProfileService } from '@gaiaprotocol/chat-client';
import { createRainbowKit, tokenManager } from '@gaiaprotocol/client-common';
import { BackButtonEvent, setupConfig } from '@ionic/core';
import { defineCustomElements } from '@ionic/core/loader';
import { initializeApp } from 'firebase/app';
import { getMessaging /*, getToken*/ } from 'firebase/messaging';
import Navigo from 'navigo';
import { getAddress } from 'viem';
import { fetchGaiaNames } from './api/gaia-name';
import { fetchGoogleMe, GoogleMe, linkGoogleWeb3Wallet } from './api/google';
import { fetchMainGodsWithNfts } from './api/main-gods-with-nfts';
import { validateToken } from './auth/validate';
import { showGodModeRequirementDialog } from './components/god-mode-req-alert';
import './main.css';
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

const isWebView = new URLSearchParams(window.location.search).get('source') === 'webview';

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
  // Modern browsers return a Promise. The callback signature is deprecated.
  try {
    return await Notification.requestPermission();
  } catch {
    // Fallback for older browsers just in case
    return new Promise((resolve) => {
      Notification.requestPermission((perm: NotificationPermission) => resolve(perm));
    });
  }
}

// Uncomment when you are ready to fetch FCM tokens
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
  // If not mounted, create layout once
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
  // Remove any unauth view
  safeRemove(unauthView); unauthView = undefined;
  mountContent(content);
}

function showUnauthed(factory: () => View) {
  // Tear down layout entirely
  if (layoutView) { safeRemove(layoutView); layoutView = undefined; contentContainer = undefined; }
  safeRemove(unauthView);
  unauthView = factory();
  document.body.appendChild(unauthView.el);
}

async function guardAuth(): Promise<'ok' | 'to-login' | 'to-link'> {
  try {
    const data = await fetchGoogleMe();
    if (data.ok === true) {
      if (data.token && data.wallet_address) {
        tokenManager.set(data.token, data.wallet_address);
        return 'ok';
      }
      tokenManager.clear();
      return 'to-link';
    }
    // If API says not ok but we already have a token, let routes try
    return tokenManager.has() ? 'ok' : 'to-login';
  } catch (e) {
    // Network issues; fall back to token presence
    return tokenManager.has() ? 'ok' : 'to-login';
  }
}

async function hardValidateSession(): Promise<boolean> {
  const ok = await validateToken();
  if (!ok) tokenManager.clear();
  return ok;
}

async function ensureGodMode(): Promise<boolean> {
  const address = tokenManager.getAddress();
  if (!address) return false;
  const hasGodMode = await checkGodMode(address);
  if (!hasGodMode) {
    showGodModeRequirementDialog();
    tokenManager.clear();
    return false;
  }
  return true;
}

// ------------------------------
// Routes
// ------------------------------
router.on(ROUTES.ROOT, async () => {
  const gate = await guardAuth();
  if (gate === 'to-login') return router.navigate(ROUTES.LOGIN);
  if (gate === 'to-link') return router.navigate(ROUTES.LINK_WALLET);

  // Deep validation (JWT + god mode)
  const valid = await hardValidateSession();
  if (!valid) return router.resolve();
  if (!(await ensureGodMode())) return router.navigate(ROUTES.LOGIN);

  const view = createHomeView();
  showAuthed(view);
  // Scroll bottom twice (layout settle + content paint)
  scrollBottomSoon();
  window.setTimeout(scrollBottomSoon, 120);
});

router.on(ROUTES.LOGIN, () => {
  // If already authenticated, hop back to root
  if (tokenManager.has()) return router.navigate(ROUTES.ROOT);
  showUnauthed(() => createLoginView(router));
});

router.on(ROUTES.LINK_WALLET, () => {
  if (tokenManager.has()) return router.navigate(ROUTES.ROOT);
  showUnauthed(() => createGoogleLinkWeb3WalletView(router));
});

router.notFound(() => router.navigate(ROUTES.ROOT));

// ------------------------------
// Bootstrap
// ------------------------------
(async function bootstrap() {
  // 0) 지갑 토큰/주소 존재 여부
  const walletHasToken = tokenManager.has();

  // 1) Google 세션 상태 확인
  let googleMe: GoogleMe | null = null;
  try {
    googleMe = await fetchGoogleMe(); // 쿠키 세션 기반
  } catch {
    googleMe = null; // 네트워크/세션 문제 등은 null 취급
  }

  // ===== 분기 처리 =====

  // (3) 구글 로그인 X && tokenManager X => 로그인 화면
  if (!googleMe?.ok && !walletHasToken) {
    router.navigate(ROUTES.LOGIN);
    return;
  }

  // (2) 구글 로그인 O && 링크 안됨 && tokenManager X => 링크 화면
  if (googleMe?.ok && (!googleMe.wallet_address || !googleMe.token) && !walletHasToken) {
    router.navigate(ROUTES.LINK_WALLET);
    return;
  }

  // (1) tokenManager O && 구글 로그인 O => 자동 링크 시도 후 진행
  if (walletHasToken && googleMe?.ok) {
    // 이미 링크되어 있으면 바로 진행
    if (googleMe.wallet_address && googleMe.token) {
      tokenManager.set(googleMe.token, googleMe.wallet_address);
    } else {
      // 자동 링크 수행
      const authToken = tokenManager.getToken();
      if (authToken) {
        try {
          // 서버는 Authorization: Bearer <wallet jwt> 를 요구
          const linkRes = await linkGoogleWeb3Wallet(authToken)

          // 링크 성공 시 최신 상태 반영
          if (linkRes?.ok) {
            // 응답에 token/wallet_address가 있으면 즉시 세팅,
            // 없으면 google-me 재조회로 보강
            if (linkRes.token && linkRes.wallet_address) {
              tokenManager.set(linkRes.token, linkRes.wallet_address);
            } else {
              const refreshed = await fetchGoogleMe();
              if (refreshed.ok && refreshed.token && refreshed.wallet_address) {
                tokenManager.set(refreshed.token, refreshed.wallet_address);
              }
            }
          }
        } catch {
          // 자동 링크 실패 시, 링크 화면으로 보냄
          router.navigate(ROUTES.LINK_WALLET);
          return;
        }
      } else {
        // 지갑 토큰을 꺼낼 수 없으면 링크 화면으로
        router.navigate(ROUTES.LINK_WALLET);
        return;
      }
    }
  }

  // 여기까지 왔다면:
  // - 이미 링크 완료 되었거나(토큰/주소 세팅됨)
  // - 혹은 tokenManager 단독(=지갑 로그인만)으로라도 접근 허용할 케이스

  // 최종 세션 검증 + God Mode 체크
  const valid = await hardValidateSession();
  if (!valid) { router.resolve(); return; }

  const address = tokenManager.getAddress();
  if (!address) { tokenManager.clear(); router.resolve(); return; }

  if (!(await ensureGodMode())) {
    router.navigate(ROUTES.LOGIN);
    return;
  }

  // 메인 진입
  router.resolve();
})();