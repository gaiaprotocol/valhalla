import { el } from '@webtaku/el';
import { View } from '../view';

function createAboutView(): View {
  const content = el('div',
    'About View',
    el('ion-toolbar', { color: 'primary' }, el('ion-title', 'About')),
    el('ion-content', 'About Content'),
  );

  return {
    el: content,
    remove: () => {
      content.remove();
    }
  };
}

export { createAboutView };
