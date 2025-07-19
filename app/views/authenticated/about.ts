import { el } from '@webtaku/el';
import { View } from '../view';

function createAboutView(): View {
  const content = el('div', 'About View');

  return {
    el: content,
    remove: () => {
      content.remove();
    }
  };
}

export { createAboutView };
