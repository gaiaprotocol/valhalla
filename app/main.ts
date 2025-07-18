import { getAccount } from '@wagmi/core';
import Navigo from 'navigo';
import { createRainbowKit, wagmiConfig } from './auth/wallet';
import './main.less';
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

function requireWallet(next: () => void) {
  const account = getAccount(wagmiConfig);
  if (!account.isConnected) {
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
  requireWallet(() => {
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
  requireWallet(() => {
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

  const account = getAccount(wagmiConfig);
  if (account.isConnected) {
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

router.resolve();
