import { el } from '@webtaku/el';
import { isMobile } from 'kiwiengine';
import Navigo from 'navigo';
import { isStandalone, launchInstallFlow } from '../../components/install-ui';
import { createDashboardModal } from '../../modals/dashboard';
import { createGodDetailModal } from '../../modals/god-detail';
import { createMyGodsModal } from '../../modals/my-gods';
import { createNameSettingsModal } from '../../modals/name-settings';
import { createNoticeModal } from '../../modals/notice';
import { createProfileModal } from '../../modals/profile';
import { isWebView } from '../../platform';
import { loadLocalizedNotices } from '../../services/notice';
import { View } from '../view';

function createHeader(router: Navigo): HTMLElement {
  // 숨겨진 모달 트리거 버튼들(기존 trigger 호환)
  const hiddenTriggers = el('div', {
    style: 'display:none'
  },
    el('ion-button', { id: 'open-dashboard' }),
    el('ion-button', { id: 'open-notice' }),
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

        // Contact Us (opens default mail app)
        el('ion-item', {
          button: true,
          detail: true,
          onclick: () => {
            const subject = encodeURIComponent('[Valhalla] Contact');
            const body = encodeURIComponent('Hello,\n\nPlease write your inquiry below.\n\nThank you.');
            window.location.href = `mailto:gaiaprotocolcontact@gmail.com?subject=${subject}&body=${body}`;
            (popover as any).dismiss?.();
          }
        },
          el('ion-icon', { slot: 'start', name: 'mail' }),
          el('ion-label', 'Contact Us')
        ),

        // App Settings
        el('ion-item', {
          button: true,
          detail: true,
          onclick: () => {
            router.navigate('/settings');
            (popover as any).dismiss?.();
          }
        },
          el('ion-icon', { slot: 'start', name: 'settings' }),
          el('ion-label', 'App Settings')
        ),

        isMobile && !isWebView && !isStandalone() ? el('ion-item', {
          button: true,
          detail: true,
          onclick: () => {
            launchInstallFlow().then((result) => console.log(result));
            (popover as any).dismiss?.()
          }
        },
          el('ion-icon', { slot: 'start', name: 'download' }), // 'install' icon may not exist; 'download' is common
          el('ion-label', 'Install App')
        ) : null
      )
    )
  );

  // 헤더는 숨기고 팝오버만 유지
  const header = el('div', {
    style: { display: 'none' }
  },
    hiddenTriggers,
    popover
  );

  return header;
}

function createLayoutView(router: Navigo): View {
  // 레이아웃은 모달과 팝오버만 제공 (각 뷰가 독립적인 구조를 가짐)
  const layout = el('div', { className: 'layout-modals' },
    createHeader(router),
    createDashboardModal(),
    createNoticeModal({ load: loadLocalizedNotices }),
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
