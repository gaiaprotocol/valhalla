import { createGaiaProtocolDashboard } from '@gaiaprotocol/god-mode-client';
import { el } from '@webtaku/el';
import Navigo from 'navigo';
import { View } from '../view';

function createDashboardView(router: Navigo): View {
  const wrapper = el('div', {
    className: 'dashboard-page',
    style: { display: 'contents' }
  });

  // 헤더
  const header = el('ion-header',
    el('ion-toolbar',
      el('ion-buttons', { slot: 'start' },
        el('ion-button', {
          onclick: () => router.navigate('/main-menu')
        },
          el('ion-icon', { slot: 'icon-only', name: 'arrow-back' })
        )
      ),
      el('ion-title', { style: { textAlign: 'center' } }, 'Dashboard'),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { style: { visibility: 'hidden' } },
          el('ion-icon', { slot: 'icon-only', name: 'ellipsis-vertical' })
        )
      )
    )
  );

  // 콘텐츠
  const content = el('ion-content', createGaiaProtocolDashboard());

  wrapper.append(header, content);

  return {
    el: wrapper,
    remove() {
      wrapper.remove();
    }
  };
}

export { createDashboardView };
