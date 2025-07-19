import { SlButton } from '@shoelace-style/shoelace';
import { disconnect, getAccount, watchAccount } from '@wagmi/core';
import { el } from '@webtaku/el';
import Navigo from 'navigo';
import { requestLogin } from '../../auth/login';
import { signMessage } from '../../auth/siwe';
import { TokenManager } from '../../auth/token';
import { openWalletConnectModal, wagmiConfig } from '../../auth/wallet';
import { showErrorAlert } from '../../components/alert';
import { View } from '../view';
import './login.less';
import logoImage from './logo.png';
import { logout } from '../../auth/logout';

export function createLoginView(router: Navigo): View {
  logout(); // logout을 먼저 실행하여 지갑 연결 해제를 보장

  const title = el('h1', { class: 'login-title' }, 'Welcome to Valhalla');

  const logo = el('img', {
    src: logoImage,
    alt: 'Valhalla Logo',
    class: 'login-logo'
  });

  const description = el(
    'p',
    { class: 'login-description' },
    'Please connect your wallet and sign a message to access Valhalla.'
  );

  const connectButton = el(
    'sl-button',
    {
      class: 'login-button',
      variant: 'primary',
      onclick: () => {
        if (getAccount(wagmiConfig).isConnected) {
          disconnect(wagmiConfig);
        } else {
          openWalletConnectModal();
        }
      }
    },
    '1. Connect Wallet'
  ) as SlButton;

  const isConnected = getAccount(wagmiConfig).isConnected;
  const signButton = el(
    'sl-button',
    {
      class: 'login-button',
      variant: isConnected ? 'primary' : 'default',
      disabled: !isConnected,
      onclick: async () => {
        signButton.loading = true;
        try {
          const signature = await signMessage();
          const token = await requestLogin(signature);
          TokenManager.set(token);
          router.navigate('/');
        } catch (error) {
          console.error(error);
          showErrorAlert('Error', error instanceof Error ? error.message : String(error));
        } finally {
          signButton.loading = false;
        }
      }
    },
    '2. Sign Message'
  ) as SlButton;

  const wrapper = el(
    '.login-wrapper',
    title,
    logo,
    description,
    connectButton,
    signButton
  );

  const unwatch = watchAccount(wagmiConfig, {
    onChange(account) {
      if (account.isConnected) {
        connectButton.textContent = 'Disconnect Wallet';
        connectButton.variant = 'default';
        signButton.disabled = false;
        signButton.variant = 'primary';
      } else {
        connectButton.textContent = '1. Connect Wallet';
        connectButton.variant = 'primary';
        signButton.disabled = true;
        signButton.variant = 'default';
      }
    }
  });

  return {
    el: wrapper,
    remove: () => {
      wrapper.remove();
      unwatch();
    }
  };
}
