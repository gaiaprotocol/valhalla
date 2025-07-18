import { disconnect } from '@wagmi/core';
import { el } from '@webtaku/el';
import { wagmiConfig } from '../../auth/wallet';
import Navigo from 'navigo';

function createLayoutView(router: Navigo) {
  return el('#layout',
    el('.header', 'header'),
    el('#content'),
    el('button', {
      onclick: async () => {
        await disconnect(wagmiConfig);
        router.navigate('/');
      }
    }, 'logout'));
};

export { createLayoutView };
