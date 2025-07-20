import { el } from "@webtaku/el";

function createDashboardModal(): HTMLElement {
  const modal = el('ion-modal.fullscreen', { trigger: 'open-dashboard' }); // 트리거는 레이아웃의 버튼 id

  const modalHeader = el('ion-header',
    el('ion-toolbar',
      el('ion-buttons', { slot: 'start' },
        el('ion-button', { onclick: () => modal.dismiss() },
          el('ion-icon', { slot: 'icon-only', name: 'chevron-back' })
        ),
      ),
      el('ion-title', { style: 'text-align: center;' }, 'Dashboard'),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { style: 'visibility: hidden' },
          el('ion-icon', { slot: 'icon-only', name: 'ellipsis-vertical' })
        ),
      )
    )
  );

  modal.append(modalHeader);

  return modal;
}

export { createDashboardModal };
