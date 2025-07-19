import { SlButton } from '@shoelace-style/shoelace';
import { disconnect, getAccount, watchAccount } from '@wagmi/core';
import { el } from '@webtaku/el';
import Navigo from 'navigo';
import { requestLogin } from '../../auth/login';
import { signMessage } from '../../auth/siwe';
import { TokenManager } from '../../auth/token';
import { openWalletConnectModal, wagmiConfig } from '../../auth/wallet';
import { showErrorAlert } from '../../components/alert';
import { showGodModeRequirementDialog } from '../../components/god-mode-req-alert';
import { checkGodMode } from '../../services/god-mode';
import { View } from '../view';
import './login.less';
import logoImage from './logo.png';

async function ensureWalletConnected(): Promise<`0x${string}`> {
  const account = getAccount(wagmiConfig);
  if (!account.isConnected || !account.address) {
    throw new Error('No wallet connected');
  }
  return account.address;
}

async function handleLoginClick(router: Navigo) {
  try {
    const address = await ensureWalletConnected();
    const signature = await signMessage(address);
    const token = await requestLogin(address, signature);

    const godMode = await checkGodMode(address);
    if (!godMode) {
      showGodModeRequirementDialog();
      return;
    }

    TokenManager.set(token, address);
    router.navigate('/');
  } catch (err) {
    console.error(err);
    showErrorAlert('Error', err instanceof Error ? err.message : String(err));
  }
}

export function createLoginView(router: Navigo): View {
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
          await handleLoginClick(router);
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
