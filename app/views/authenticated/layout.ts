import { el } from '@webtaku/el';
import Navigo from 'navigo';
import { createDashboardModal } from '../../modals/dashboard';
import { createGodDetailModal } from '../../modals/god-detail';
import { createMyGodsModal } from '../../modals/my-gods';
import { createNameSettingsModal } from '../../modals/name-settings';
import { createProfileModal } from '../../modals/profile';
import { View } from '../view';

function createHeader(): HTMLElement {
  // 숨겨진 모달 트리거 버튼들(기존 trigger 호환)
  const hiddenTriggers = el('div', {
    style: 'display:none'
  },
    el('ion-button',
      { onclick: () => open('https://dashboard.gaiaprotocol.com/') }, //{ id: 'open-dashboard' },
    ),
    el('ion-button', { id: 'open-my-gods' }),
    el('ion-button', { id: 'open-profile' })
  );

  // 메뉴 팝오버(버튼 클릭 시 표시)
  const popover = el('ion-popover', {
    id: 'main-menu',
    trigger: 'open-menu',
    triggerAction: 'click',  // 클릭 시 열림
    side: 'bottom',
    alignment: 'end',
    translucent: true
  },
    el('ion-content',
      el('ion-list',
        // Dashboard
        el('ion-item', {
          button: true,
          detail: true,
          onclick: async () => {
            const modalTrigger = document.getElementById('open-dashboard') as HTMLElement | null;
            // 모달 트리거가 있는 경우: 모달 열기
            if (modalTrigger) {
              modalTrigger.click();
            } else {
              // 백업: 외부 대시보드 링크 열기
              open('https://dashboard.gaiaprotocol.com/', '_blank');
            }
            // 팝오버 닫기
            (popover as any).dismiss?.();
          }
        },
          el('ion-icon', { slot: 'start', name: 'bar-chart-sharp' }),
          el('ion-label', 'Dashboard')
        ),

        // My Gods
        el('ion-item', {
          button: true,
          detail: true,
          onclick: () => {
            const modalTrigger = document.getElementById('open-my-gods') as HTMLElement | null;
            if (modalTrigger) modalTrigger.click();
            (popover as any).dismiss?.();
          }
        },
          el('ion-icon', { slot: 'start', name: 'sparkles' }),
          el('ion-label', 'My Gods')
        ),

        // Profile
        el('ion-item', {
          button: true,
          detail: true,
          onclick: () => {
            const modalTrigger = document.getElementById('open-profile') as HTMLElement | null;
            if (modalTrigger) modalTrigger.click();
            (popover as any).dismiss?.();
          }
        },
          el('ion-icon', { slot: 'start', name: 'person-circle' }),
          el('ion-label', 'Profile')
        ),
      )
    )
  );

  // 헤더(우측에 메뉴 버튼 하나만)
  const header = el('ion-header',
    el('ion-toolbar',
      el('ion-title', { style: 'text-align: center;' }, 'Valhalla'),
      el('ion-buttons', { slot: 'start' },
        el('ion-button', {
          id: 'open-menu',
          ariaLabel: 'Open menu'
        },
          el('ion-icon', { slot: 'icon-only', name: 'menu' })
        )
      )
    ),
    // 숨겨진 트리거/팝오버를 헤더 안에 넣어두면 유지/정리 관리가 쉬움
    hiddenTriggers,
    popover
  );

  return header;
}

function createLayoutView(router: Navigo): View {
  const layout = el('ion-app',
    createHeader(),
    el('ion-content', { className: 'content' }),
    // 기존 모달 유지(트리거는 숨겨둔 버튼이 담당)
    createDashboardModal(),
    createMyGodsModal(),
    createGodDetailModal(),
    createProfileModal(router),
    createNameSettingsModal(),
  );

  // 라우터 연동: 상단에서 디스패치한 navigate 이벤트 수신
  const onNavigate = (e: Event) => {
    const { detail } = e as CustomEvent<{ path: string }>;
    if (detail?.path) router.navigate(detail.path);
  };
  window.addEventListener('app:navigate', onNavigate);

  return {
    el: layout,
    remove: () => {
      window.removeEventListener('app:navigate', onNavigate);
      layout.remove();
    }
  };
}

export { createLayoutView };
