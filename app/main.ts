import { chatProfileService } from '@gaiaprotocol/chat-client';
import { createRainbowKit, tokenManager } from '@gaiaprotocol/client-common';
import { BackButtonEvent, setupConfig } from '@ionic/core';
import { defineCustomElements } from '@ionic/core/loader';
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';
import Navigo from 'navigo';
import { fetchGaiaNames } from './api/gaia-name';
import { validateToken } from './auth/validate';
import { showGodModeRequirementDialog } from './components/god-mode-req-alert';
import './main.css';
import { checkGodMode } from './services/god-mode';
import { createHomeView } from './views/authenticated/home';
import { createLayoutView } from './views/authenticated/layout';
import { createLoginView } from './views/unauthenticated/login';
import { View } from './views/view';
import { fetchMainGodsWithNfts } from './api/main-gods-with-nfts';
import { getAddress } from 'viem';

setupConfig({
  hardwareBackButton: true,
  experimentalCloseWatcher: true
});

document.addEventListener('ionBackButton' as any, (event: BackButtonEvent) => {
  event.detail.register(0, () => {
    window.history.back();
  });
});

defineCustomElements(window);
document.body.appendChild(createRainbowKit());

const urlParams = new URLSearchParams(window.location.search);
const isWebView = urlParams.get('source') === 'webview';
if (!isWebView) {

  const firebaseConfig = {
    apiKey: 'AIzaSyD21Q4smrSlTxs-FucpGnW2FX_br1rm0HA',
    authDomain: 'gaia-valhalla.firebaseapp.com',
    projectId: 'gaia-valhalla',
    storageBucket: 'gaia-valhalla.firebasestorage.app',
    messagingSenderId: '797829770593',
    appId: '1:797829770593:web:ac557a31562d0c8bd26920',
    measurementId: 'G-GP4SH06LSL'
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  async function requestNotificationPermission() {
    return new Promise<NotificationPermission>((resolve) => {
      Notification.requestPermission((permission) => resolve(permission));
    });
  }

  /*requestNotificationPermission().then((permission) => {
    if (permission === "granted") {
      getToken(messaging, { vapidKey: 'BGPXUkzHHkFCCnB0qvuEkj3VtJ3eK8z71PvYTorx4xRq9lBaY9BE4knxb1i13Qn49nogLJX9B1zOoX-Gvaj5TjI' }).then((token) => {
        console.log(token);
      });
    } else {
      console.log("Permission denied:", permission);
    }
  });*/
}

chatProfileService.init(async (addresses) => {
  // 주소 정규화(체크섬) – names, nfts 모두 같은 키를 쓰도록
  const normalized = addresses.map(getAddress);

  const [names, nfts] = await Promise.all([
    fetchGaiaNames(normalized),           // Record<checksumAddr, name>
    fetchMainGodsWithNfts(normalized),    // { address, nft?: { image? } }[]
  ]);

  // 주소 → NFT 응답 매핑 (체크섬 주소 기준)
  const nftMap = new Map<string, { image?: string | null } | null>();
  for (const row of nfts) {
    const addr = getAddress(row.address);
    nftMap.set(addr, row.nft ?? null);
  }

  const result: Record<string, { nickname?: string | null; profileImage?: string | null } | null> = {};
  for (const addr of normalized) {
    const nft = nftMap.get(addr) ?? null;
    const imageUrl = nft?.image ?? null;

    result[addr] = {
      nickname: names[addr] ?? null,
      profileImage: imageUrl,
    };
  }

  return result;
});

const router = new Navigo('/');

let layoutView: View | undefined;
let contentContainer: HTMLElement | undefined;
let loginView: View | undefined;

function removeLoginView() {
  loginView?.remove();
  loginView = undefined;
}

function requireAuth(next: () => void) {
  if (!tokenManager.has()) {
    router.navigate('/login');
  } else {
    next();
  }
}

/**
 * 최초 로그인 후 layout을 생성하고 content만 교체
 */
function renderContent(content: View) {
  removeLoginView();

  if (!layoutView) {
    layoutView = createLayoutView(router);
    contentContainer = layoutView.el.querySelector('.content') as HTMLElement;
    contentContainer.appendChild(content.el);
    document.body.appendChild(layoutView.el);
  } else {
    contentContainer!.innerHTML = '';
    contentContainer!.appendChild(content.el);
  }
}

/**
 * layout을 완전히 제거하고 로그인 화면 표시
 */
function renderLogin() {
  if (layoutView) {
    layoutView.remove();
    layoutView = undefined;
    contentContainer = undefined;
  }
  removeLoginView();

  loginView = createLoginView(router);
  document.body.appendChild(loginView.el);
}

router.on('/', () => {
  removeLoginView();
  requireAuth(() => {
    const view = createHomeView();
    renderContent(view);
    view.scrollToBottom();
    setTimeout(() => view.scrollToBottom(), 100);
  });
});

router.on('/login', () => {
  if (layoutView) {
    layoutView.remove();
    layoutView = undefined;
    contentContainer = undefined;
  }

  if (tokenManager.has()) {
    router.navigate('/');
  } else {
    renderLogin();
  }
});

(async () => {
  const ok = await validateToken();
  if (!ok) {
    tokenManager.clear();
    router.resolve();
    return;
  }

  const address = tokenManager.getAddress();
  if (!address) {
    tokenManager.clear();
    router.resolve();
    return;
  }

  const hasGodMode = await checkGodMode(address);
  if (!hasGodMode) {
    showGodModeRequirementDialog();
    tokenManager.clear();
    router.navigate('/login');
    return;
  }

  router.resolve();
})();
