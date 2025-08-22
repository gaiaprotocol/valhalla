import { el } from "@webtaku/el";
import { marked } from "marked";
import { Notice } from "../types/notice";

const renderer = new marked.Renderer();
renderer.link = ({ href, title, text }) => {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};
marked.setOptions({ renderer });

function createNoticeModal(notices: Notice[]): HTMLElement {
  const modal = el('ion-modal', { trigger: 'open-notice' });

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
            el('p', `${notice.createdAt}`)
          )
        )
      )
    )
  );

  modal.append(modalHeader, modalContent);

  return modal;
}

function createNoticeDetailModal(notice: Notice): HTMLIonModalElement {
  const detailModal = el('ion-modal');

  const header = el('ion-header',
    el('ion-toolbar',
      el('ion-title', notice.title),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { onclick: () => detailModal.dismiss() }, 'Close')
      )
    )
  );

  const content = el('ion-content.ion-padding');
  const mdContainer = el('div');

  const result = marked.parse(notice.content);

  if (result instanceof Promise) {
    result.then(html => {
      mdContainer.innerHTML = html;
    });
  } else {
    mdContainer.innerHTML = result;
  }

  const date = el('p.notice-date', notice.createdAt);

  content.append(date, mdContainer);

  detailModal.append(header, content);

  return detailModal;
}

export { createNoticeDetailModal, createNoticeModal };
