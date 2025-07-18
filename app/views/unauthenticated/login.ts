import { SlButton } from "@shoelace-style/shoelace";
import { disconnect, getAccount, watchAccount } from "@wagmi/core";
import { el } from "@webtaku/el";
import Navigo from "navigo";
import { openWalletConnectModal, wagmiConfig } from "../../auth/wallet";
import { View } from "../view";
import "./login.less";
import logoImage from './logo.png';

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

  const signButton = el(
    'sl-button',
    {
      class: 'login-button',
      variant: 'primary',
      disabled: !getAccount(wagmiConfig).isConnected,
      onclick: () => {
        // 여기에 메시지 서명 로직 추가
        alert('Message signed (placeholder)');
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
