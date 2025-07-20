import { el } from "@webtaku/el";

 function createNoticeModal(): HTMLElement {
  const modal = el('ion-modal', { trigger: 'open-notice' });

  const notices = [
    { title: 'New Feature Released', date: '2025-07-15', content: 'We have released a new feature for better user experience.' },
    { title: 'Scheduled Maintenance', date: '2025-07-10', content: 'Our service will be down for maintenance from 1 AM to 3 AM.' },
    { title: 'Welcome to Valhalla', date: '2025-07-01', content: 'Thank you for joining Valhalla. Let’s get started!' },
  ];

  const modalHeader = el('ion-header',
    el('ion-toolbar',
      el('ion-title', 'Notices'),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { onclick: () => modal.dismiss() }, 'Close')
      ),
    )
  );

  const modalContent = el('ion-content.ion-padding',
    el('ion-list',
      ...notices.map(notice =>
        el('ion-item', {
          button: true,
          onclick: () => {
            const detailModal = createNoticeDetailModal(notice);
            document.body.appendChild(detailModal);
            detailModal.present();
          }
        },
          el('ion-label',
            el('h2', notice.title),
            el('p', `${notice.date}`)
          )
        )
      )
    )
  );

  modal.append(modalHeader, modalContent);

  return modal;
}

function createNoticeDetailModal(notice: { title: string, date: string, content: string }): HTMLIonModalElement {
  const detailModal = el('ion-modal');

  const header = el('ion-header',
    el('ion-toolbar',
      el('ion-title', notice.title),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { onclick: () => detailModal.dismiss() }, 'Close')
      )
    )
  );

  const content = el('ion-content.ion-padding',
    el('p', `📅 ${notice.date}`),
    el('p', notice.content)
  );

  detailModal.append(header, content);

  return detailModal;
}

export { createNoticeModal, createNoticeDetailModal };
