import { el } from "@webtaku/el";
import "./login.less";
import { openWalletConnectModal, wagmiConfig } from "../../auth/wallet";
import { watchAccount } from "@wagmi/core";
import Navigo from "navigo";

export function createLoginView(router: Navigo): HTMLElement {
  const title = el('h1', { class: 'login-title' }, 'Login');
  const description = el('p', { class: 'login-description' }, 'Please connect your wallet to continue.');

  const connectButton = el(
    'sl-button',
    {
      class: 'login-button',
      onclick: () => {
        openWalletConnectModal();
      }
    },
    'Connect Wallet'
  );

  const wrapper = el(
    'div',
    { class: 'login-wrapper' },
    title,
    description,
    connectButton
  );

  const unwatch = watchAccount(wagmiConfig, {
    onChange(account) {
      if (!wrapper.isConnected) {
        unwatch();
      } else if (account.isConnected) {
        router.navigate('/');
      }
    },
  });

  return wrapper;
}
