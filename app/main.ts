import Navigo from 'navigo';
import { TokenManager } from './auth/token';
import { validateToken } from './auth/validate';
import { createRainbowKit } from './auth/wallet';
import { showGodModeRequirementDialog } from './components/god-mode-req-alert';
import './main.less';
import { checkGodMode } from './services/god-mode';
import { createAboutView } from './views/authenticated/about';
import { createLayoutView } from './views/authenticated/layout';
import { createLoginView } from './views/unauthenticated/login';
import { View } from './views/view';

document.body.appendChild(createRainbowKit());

const router = new Navigo('/');

let layoutView: View | undefined;
let contentContainer: HTMLElement | undefined;
let loginView: View | undefined;

function removeLoginView() {
  loginView?.remove();
  loginView = undefined;
}

function requireAuth(next: () => void) {
  if (!TokenManager.has()) {
    router.navigate('/login');
  } else {
    next();
  }
}

function saveLastPath(path: string) {
  localStorage.setItem('lastPath', path);
}

/**
 * 최초 로그인 후 layout을 생성하고 content만 교체
 */
function renderContent(content: View) {
  removeLoginView();

  if (!layoutView) {
    layoutView = createLayoutView(router);
    contentContainer = layoutView.el.querySelector('#content') as HTMLElement;
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

// 루트: 로그인 되어있으면 마지막 path, 아니면 로그인
router.on('/', () => {
  removeLoginView();
  requireAuth(() => {
    const lastPath = localStorage.getItem('lastPath');
    if (!lastPath || lastPath === '/login') {
      router.navigate('/about');
    } else {
      router.navigate(lastPath);
    }
  });
});

// About
router.on('/about', () => {
  requireAuth(() => {
    console.log('About page');
    saveLastPath('/about');
    renderContent(createAboutView());
  });
});

// Login
router.on('/login', () => {
  if (layoutView) {
    layoutView.remove();
    layoutView = undefined;
    contentContainer = undefined;
  }

  if (TokenManager.has()) {
    const lastPath = localStorage.getItem('lastPath');
    if (!lastPath || lastPath === '/login') {
      router.navigate('/');
    } else {
      router.navigate(lastPath);
    }
  } else {
    renderLogin();
  }
});

(async () => {
  const ok = await validateToken();
  if (!ok) {
    TokenManager.clear();
    router.resolve();
    return;
  }

  const address = TokenManager.getAddress();
  if (!address) {
    TokenManager.clear();
    router.resolve();
    return;
  }

  const hasGodMode = await checkGodMode(address);
  if (!hasGodMode) {
    showGodModeRequirementDialog();
    TokenManager.clear();
    router.navigate('/login');
    return;
  }

  router.resolve();
})();
