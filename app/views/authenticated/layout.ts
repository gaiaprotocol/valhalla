import { el } from '@webtaku/el';
import Navigo from 'navigo';
import { createDashboardModal } from '../../modals/dashboard';
import { createProfileModal } from '../../modals/profile';
import { View } from '../view';

function createHeader(): HTMLElement {
  return el('ion-header',
    el('ion-toolbar',
      el('ion-buttons', { slot: 'start' },
        el('ion-button', { onclick: () => open('https://dashboard.gaiaprotocol.com/') }, //{ id: 'open-dashboard' },
          el('ion-icon', { slot: 'icon-only', name: 'bar-chart-sharp' })  // Dashboard 아이콘
        )
      ),
      el('ion-title', { style: 'text-align: center;' }, 'Valhalla'),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { id: 'open-profile' },
          el('ion-icon', { slot: 'icon-only', name: 'person-circle' })  // 유저 아이콘
        )
      )
    )
  );
}

function createLayoutView(router: Navigo): View {
  const layout = el('ion-app',
    createHeader(),
    el('ion-content.content'),
    createDashboardModal(),
    createProfileModal(router),
  );

  return {
    el: layout,
    remove: () => {
      layout.remove();
    }
  };
}

export { createLayoutView };
