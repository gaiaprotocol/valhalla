import { el } from '@webtaku/el';
import { View } from '../view';

function createHomeView(): View {
  const page = el('ion-page', 'Home');

  return {
    el: page,
    remove: () => {
      page.remove();
    }
  };
}

export { createHomeView };
