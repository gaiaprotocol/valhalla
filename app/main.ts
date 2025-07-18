import { getAccount, watchAccount } from '@wagmi/core';
import { el } from '@webtaku/el';
import { createRainbowKit, openWalletConnectModal, wagmiConfig } from './components/connect-wallet-button';
import './main.less';

document.body.append(
  createRainbowKit(),
  el('sl-button', {
    size: 'small', onclick: () => {
      const account = getAccount(wagmiConfig);

      if (account.isConnected) {
        console.log('지갑 연결됨:', account.address);
      } else {
        console.log('지갑이 연결되지 않았습니다.');
      }

      openWalletConnectModal();
    }
  }, 'Connect Wallet'),
);

watchAccount(wagmiConfig, {
  onChange(account) {
    if (account.isConnected) {
      console.log(`🔗 지갑 연결됨: ${account.address}`);
    } else {
      console.log(`🚫 지갑 연결 해제됨`);
    }
  },
});
