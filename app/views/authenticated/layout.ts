import { el } from '@webtaku/el';
import Navigo from 'navigo';
import { logout } from '../../auth/logout';
import { View } from '../view';

function createLayoutView(router: Navigo): View {
  const layout = el('#layout',
    el('.header', 'header'),
    el('#content'),
    el('button', {
      onclick: async () => {
        await logout();
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
