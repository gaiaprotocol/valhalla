import { el } from '@webtaku/el';
import Navigo from 'navigo';
import { createNoticeDetailModal } from '../../modals/notice';
import { loadLocalizedNotices } from '../../services/notice';
import { View } from '../view';

// 읽은 공지사항 관리
const STORAGE_KEY = 'valhalla_read_notices';

function getReadNotices(): Set<number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function markAsRead(noticeId: number): void {
  try {
    const readNotices = getReadNotices();
    readNotices.add(noticeId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(readNotices)));
  } catch (e) {
    console.error('Failed to mark notice as read:', e);
  }
}

function typeMeta(t?: string) {
  const v = (t || '').toLowerCase();
  if (v === 'update') return { label: 'Update', color: 'success' as const };
  if (v === 'news') return { label: 'News', color: 'primary' as const };
  const pretty = v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Notice';
  return { label: pretty, color: 'medium' as const };
}

function formatDate(date: string | number) {
  try {
    return new Intl.DateTimeFormat('en', {
      year: 'numeric', month: 'short', day: 'numeric',
    }).format(new Date(date));
  } catch {
    return String(date);
  }
}

function createNoticesView(router: Navigo): View {
  const wrapper = el('div', {
    className: 'notices-page',
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
      el('ion-title', { style: { textAlign: 'center' } }, 'Notices'),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { style: { visibility: 'hidden' } },
          el('ion-icon', { slot: 'icon-only', name: 'ellipsis-vertical' })
        )
      )
    )
  );

  // 콘텐츠
  const listContainer = el('ion-list');
  const loading = el('ion-item', el('ion-label', 'Loading...'));

  const content = el('ion-content', { className: 'ion-padding' },
    el('div', { style: { minHeight: '80px' } }, loading, listContainer)
  );

  wrapper.append(header, content);

  // 공지사항 로드 및 렌더링
  loadLocalizedNotices().then(notices => {
    if (loading.isConnected) loading.remove();

    if (!notices.length) {
      (listContainer as HTMLElement).replaceChildren(
        el('ion-item', el('ion-label', 'No notices found'))
      );
      return;
    }

    const readNotices = getReadNotices();

    const items = notices.map((notice) => {
      const tm = typeMeta((notice as any).type);
      const isRead = readNotices.has(notice.id);

      // Create elements that need to be updated on click
      const unreadDot = !isRead ? el('ion-icon', {
        name: 'ellipse',
        slot: 'start',
        style: { fontSize: '0.5rem', color: '#C1A87D' }
      }) : null;

      const titleEl = el('h2', { style: { fontWeight: isRead ? '400' : '600' } }, notice.title);

      const item = el(
        'ion-item',
        {
          button: true,
          style: {
            opacity: isRead ? '0.6' : '1',
            position: 'relative'
          },
          onclick: () => {
            // Update UI immediately
            (item as HTMLElement).style.opacity = '0.6';
            if (unreadDot) unreadDot.remove();
            (titleEl as HTMLElement).style.fontWeight = '400';

            // Save to storage
            markAsRead(notice.id);

            // Open modal
            const detailModal = createNoticeDetailModal(notice);
            document.body.appendChild(detailModal);
            (detailModal as any).present?.();
          },
        },
        unreadDot,
        el('ion-badge', { slot: 'end', color: tm.color }, tm.label),
        el('ion-label',
          titleEl,
          el('p', `${formatDate(notice.createdAt as any)}`)
        )
      );

      return item;
    });

    (listContainer as HTMLElement).replaceChildren(...items);
  }).catch(e => {
    if (loading.isConnected) loading.remove();
    (listContainer as HTMLElement).replaceChildren(
      el('ion-item', el('ion-label', 'Failed to load notices'))
    );
    console.error(e);
  });

  return {
    el: wrapper,
    remove() {
      wrapper.remove();
    }
  };
}

export { createNoticesView };
