import { openWalletConnectModal, tokenManager, wagmiConfig } from '@gaiaprotocol/client-common';
import { SlButton } from '@shoelace-style/shoelace';
import { disconnect, getAccount, watchAccount } from '@wagmi/core';
import { el } from "@webtaku/el";
import Navigo from "navigo";
import { signMessage } from '../../auth/siwe';
import { showErrorAlert } from '../../components/alert';
import { View } from "../view";
import './login.css';

async function ensureWalletConnected(): Promise<`0x${string}`> {
  const account = getAccount(wagmiConfig);
  if (!account.isConnected || !account.address) {
    throw new Error('No wallet connected');
  }
  return account.address;
}

export function createGoogleLinkWeb3WalletView(router: Navigo): View {
  const title = el('h1.login-title', 'Link your Web3 Wallet');
  const description = el(
    'p.login-description',
    'You’re signed in with Google. Connect your wallet and sign a message to link it to your account.'
  );

  // ── 구글 로그아웃 핸들러 ─────────────────────────────────────────────
  const handleGoogleLogout = async () => {
    try {
      // 서버 세션 종료
      const res = await fetch('/api/google-logout', { method: 'POST' });
      if (!res.ok) {
        const msg = await res.text().catch(() => 'Failed to logout');
        throw new Error(msg || 'Failed to logout');
      }

      // 토큰/지갑 상태 정리
      try {
        tokenManager.clear(); // clear 메서드가 있으면 사용
      } catch { }
      try {
        await disconnect(wagmiConfig);
      } catch { }

      // 로그인 페이지로 이동
      router.navigate('/login');
    } catch (err) {
      console.error(err);
      showErrorAlert('Logout failed', err instanceof Error ? err.message : String(err));
    }
  };

  // ── 1) 지갑 연결/해제 버튼 ─────────────────────────────────────────
  const connectButton = el(
    'sl-button.login-button',
    {
      variant: 'primary',
      onclick: () => {
        if (getAccount(wagmiConfig).isConnected) {
          disconnect(wagmiConfig);
          linkButton.loading = false;
        } else {
          openWalletConnectModal();
        }
      }
    },
    '1. Connect Wallet'
  ) as SlButton;

  // ── 2) 링크(서명) 버튼 ────────────────────────────────────────────
  const isConnected = getAccount(wagmiConfig).isConnected;
  const linkButton = el(
    'sl-button.login-button',
    {
      variant: isConnected ? 'primary' : 'default',
      disabled: !isConnected,
      onclick: async () => {
        linkButton.loading = true;
        try {
          const address = await ensureWalletConnected();
          const signature = await signMessage(address);

          const res = await fetch('/api/google-link-web3-wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, signature })
          });

          if (!res.ok) {
            const msg = await res.text().catch(() => 'Failed to link wallet');
            throw new Error(msg || 'Failed to link wallet');
          }

          router.navigate('/');
        } catch (err) {
          console.error(err);
          showErrorAlert('Link failed', err instanceof Error ? err.message : String(err));
        } finally {
          linkButton.loading = false;
        }
      }
    },
    '2. Link Wallet'
  ) as SlButton;

  // ── 3) 구글 로그아웃 버튼 ─────────────────────────────────────────
  const googleLogoutButton = el(
    'sl-button.login-button.google-logout',
    {
      variant: 'default',
      'aria-label': 'Logout from Google',
      onclick: handleGoogleLogout
    },
    'Sign out of Google'
  ) as SlButton;

  // 레이아웃
  const wrapper = el(
    '.login-wrapper',
    title,
    description,
    connectButton,
    linkButton,
    el('.login-or',
      el('span.login-or-line'),
      el('span.login-or-text', '— or —'),
      el('span.login-or-line'),
    ),
    googleLogoutButton
  );

  // 지갑 상태 변경 감지
  const unwatch = watchAccount(wagmiConfig, {
    onChange(account) {
      if (account.isConnected) {
        connectButton.textContent = 'Disconnect Wallet';
        connectButton.variant = 'default';
        linkButton.disabled = false;
        linkButton.variant = 'primary';
      } else {
        connectButton.textContent = '1. Connect Wallet';
        connectButton.variant = 'primary';
        linkButton.disabled = true;
        linkButton.variant = 'default';
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
