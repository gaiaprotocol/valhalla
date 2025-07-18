import { disconnect } from '@wagmi/core';
import { el } from '@webtaku/el';
import { wagmiConfig } from '../../auth/wallet';
import Navigo from 'navigo';
import { View } from '../view';

function createLayoutView(router: Navigo): View {
  const layout = el('#layout',
    el('.header', 'header'),
    el('#content'),
    el('button', {
      onclick: async () => {
        await disconnect(wagmiConfig);
        router.navigate('/');
      }
    }, 'logout'));

  return {
    el: layout,
    remove: () => {
      layout.remove();
    }
  };
};

export { createLayoutView };
