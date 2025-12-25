import { el } from '@webtaku/el';
import Navigo from 'navigo';
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

function createMainMenuView(router: Navigo): View {
  // wrapper는 display: contents로 실제로는 자식만 렌더링됨
  const wrapper = el('div', {
    className: 'main-menu-page',
    style: { display: 'contents' }
  });

  // 헤더 with 메뉴 버튼
  const header = el('ion-header',
    el('ion-toolbar',
      el('ion-buttons', { slot: 'start' },
        el('ion-button', {
          id: 'open-menu',
          onclick: () => {
            const popover = document.getElementById('main-menu') as any;
            if (popover) popover.present();
          }
        },
          el('ion-icon', { slot: 'icon-only', name: 'menu' })
        )
      ),
      el('ion-title', { style: { textAlign: 'center' } }, 'Valhalla'),
      el('ion-buttons', { slot: 'end' },
        el('ion-button', { style: { visibility: 'hidden' } },
          el('ion-icon', { slot: 'icon-only', name: 'ellipsis-vertical' })
        )
      )
    )
  );

  // 타이틀
  const title = el('h1', {
    className: 'main-menu-title',
    style: {
      fontSize: '2.5rem',
      fontWeight: '700',
      marginBottom: '0.5rem',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #C1A87D 0%, #e8d4a8 100%)',
      webkitBackgroundClip: 'text',
      webkitTextFillColor: 'transparent',
      backgroundClip: 'text'
    }
  }, 'Welcome to Valhalla');

  const subtitle = el('p', {
    style: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: '0.875rem',
      marginBottom: '3rem',
      textAlign: 'center',
      letterSpacing: '2px',
      textTransform: 'uppercase'
    }
  }, 'Choose your destination');

  // 카드 컨테이너
  const cardContainer = el('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '1.5rem',
      width: '100%',
      maxWidth: '900px',
      padding: '0 1rem'
    }
  });

  // 공지사항 카드
  const noticeBadge = el('ion-badge', {
    style: {
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      fontSize: '0.875rem',
      padding: '0.5rem 0.75rem',
      borderRadius: '20px',
      backgroundColor: '#C1A87D',
      color: '#000',
      fontWeight: '600',
      display: 'none'
    }
  });

  const noticeCard = el('ion-card', {
    button: true,
    className: 'menu-card',
    onclick: () => router.navigate('/notices'),
    style: {
      margin: '0',
      background: 'rgba(193, 168, 125, 0.1)',
      border: '1px solid rgba(193, 168, 125, 0.3)',
      borderRadius: '20px',
      transition: 'all 0.3s ease',
      position: 'relative'
    }
  },
    noticeBadge,
    el('ion-card-content', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 2rem',
        textAlign: 'center'
      }
    },
      el('ion-icon', {
        name: 'notifications-outline',
        style: { fontSize: '4rem', color: '#C1A87D', marginBottom: '1.5rem' }
      }),
      el('h2', {
        style: { fontSize: '1.5rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }
      }, 'Notices'),
      el('p', {
        style: { fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', margin: '0' }
      }, 'View announcements and updates')
    )
  );

  // 읽지 않은 공지사항 개수 확인
  loadLocalizedNotices().then(notices => {
    const readNotices = getReadNotices();
    const unreadCount = notices.filter(n => !readNotices.has(n.id)).length;
    if (unreadCount > 0) {
      noticeBadge.textContent = String(unreadCount);
      noticeBadge.style.display = 'block';
    }
  }).catch(() => { /* ignore */ });

  // 대시보드 카드
  const dashboardCard = el('ion-card', {
    button: true,
    className: 'menu-card',
    onclick: () => router.navigate('/dashboard'),
    style: {
      margin: '0',
      background: 'rgba(1, 99, 170, 0.1)',
      border: '1px solid rgba(1, 99, 170, 0.3)',
      borderRadius: '20px',
      overflow: 'hidden',
      transition: 'all 0.3s ease'
    }
  },
    el('ion-card-content', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 2rem',
        textAlign: 'center'
      }
    },
      el('ion-icon', {
        name: 'stats-chart-outline',
        style: { fontSize: '4rem', color: '#0163aa', marginBottom: '1.5rem' }
      }),
      el('h2', {
        style: { fontSize: '1.5rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }
      }, 'Dashboard'),
      el('p', {
        style: { fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', margin: '0' }
      }, 'View Gaia Protocol statistics')
    )
  );

  // 채팅방 카드
  const chatCard = el('ion-card', {
    button: true,
    className: 'menu-card',
    onclick: () => router.navigate('/chat'),
    style: {
      margin: '0',
      background: 'rgba(96, 48, 255, 0.1)',
      border: '1px solid rgba(96, 48, 255, 0.3)',
      borderRadius: '20px',
      overflow: 'hidden',
      transition: 'all 0.3s ease'
    }
  },
    el('ion-card-content', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 2rem',
        textAlign: 'center'
      }
    },
      el('ion-icon', {
        name: 'chatbubbles-outline',
        style: { fontSize: '4rem', color: '#6030ff', marginBottom: '1.5rem' }
      }),
      el('h2', {
        style: { fontSize: '1.5rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }
      }, 'Chat Room'),
      el('p', {
        style: { fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', margin: '0' }
      }, 'Join the community chat')
    )
  );

  cardContainer.append(noticeCard, dashboardCard, chatCard);

  // 컨텐츠 래퍼 (중앙 정렬용)
  const contentWrapper = el('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: '100%',
      paddingTop: '2rem',
      paddingBottom: '2rem'
    }
  }, title, subtitle, cardContainer);

  const content = el('ion-content');
  (content as HTMLElement).style.setProperty('--background', 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%)');
  content.append(contentWrapper);

  wrapper.append(header, content);

  return {
    el: wrapper,
    remove() {
      wrapper.remove();
    }
  };
}

export { createMainMenuView };
