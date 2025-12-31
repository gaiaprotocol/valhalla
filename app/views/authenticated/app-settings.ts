import { el } from '@webtaku/el';
import type { FirebaseApp } from 'firebase/app';
import Navigo from 'navigo';
import { unregisterFcmToken } from '../../api/fcm';
import { isStandalone } from '../../components/install-ui';
import {
  clearFcmToken,
  getCurrentFcmToken,
  getPushPermissionStatus,
  initializePushNotifications,
} from '../../services/push-notification';
import { View } from '../view';

interface AppSettingsViewOptions {
  firebaseApp: FirebaseApp | null;
}

function createAppSettingsView(router: Navigo, options: AppSettingsViewOptions): View {
  const wrapper = el('div', {
    className: 'app-settings-page',
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
      el('ion-title', 'Settings')
    )
  );

  // 푸시 알림 토글
  const pushToggle = el('ion-toggle', {
    slot: 'end',
  }) as HTMLIonToggleElement;

  // 권한 거부 안내 메시지
  const deniedNote = el('ion-note', {
    style: {
      display: 'none',
      padding: '1rem',
      color: 'var(--ion-color-warning)',
      fontSize: '0.875rem',
    }
  },
    el('ion-icon', {
      name: 'warning-outline',
      style: { marginRight: '0.5rem', verticalAlign: 'middle' }
    }),
    'Push notifications are blocked.'
  );

  // 권한 거부 시 설정 열기 안내 (브라우저 모드)
  const browserSettingsNote = el('ion-item', {
    style: { display: 'none' },
    lines: 'none'
  },
    el('ion-label', {
      style: { fontSize: '0.875rem', color: 'var(--ion-color-medium)' }
    },
      el('p', { style: { margin: '0 0 0.5rem 0' } },
        'To enable push notifications:'
      ),
      el('ol', {
        style: {
          margin: '0',
          paddingLeft: '1.25rem',
          lineHeight: '1.6'
        }
      },
        el('li', 'Click the lock/info icon in your browser address bar'),
        el('li', 'Find "Notifications" in site settings'),
        el('li', 'Change from "Block" to "Allow"'),
        el('li', 'Reload the page')
      )
    )
  );

  // 권한 거부 시 설정 열기 안내 (PWA 모드)
  const pwaSettingsNote = el('ion-item', {
    style: { display: 'none' },
    lines: 'none'
  },
    el('ion-label', {
      style: { fontSize: '0.875rem', color: 'var(--ion-color-medium)' }
    },
      el('p', { style: { margin: '0 0 0.5rem 0' } },
        'To enable push notifications:'
      ),
      el('ol', {
        style: {
          margin: '0',
          paddingLeft: '1.25rem',
          lineHeight: '1.6'
        }
      },
        el('li', 'Open your device\'s Settings app'),
        el('li', 'Find this app in your app list'),
        el('li', 'Tap "Notifications" and enable them'),
        el('li', 'Return to this app')
      )
    )
  );

  // 푸시 알림 상태 업데이트 함수
  const updatePushUI = () => {
    const permission = getPushPermissionStatus();
    const token = getCurrentFcmToken();
    const isPWA = isStandalone();

    if (permission === 'unsupported') {
      pushToggle.disabled = true;
      pushToggle.checked = false;
      deniedNote.textContent = 'Push notifications are not supported in this browser.';
      deniedNote.style.display = 'block';
      browserSettingsNote.style.display = 'none';
      pwaSettingsNote.style.display = 'none';
    } else if (permission === 'denied') {
      pushToggle.disabled = true;
      pushToggle.checked = false;
      deniedNote.style.display = 'block';
      browserSettingsNote.style.display = isPWA ? 'none' : '';
      pwaSettingsNote.style.display = isPWA ? '' : 'none';
    } else {
      pushToggle.disabled = false;
      pushToggle.checked = permission === 'granted' && !!token;
      deniedNote.style.display = 'none';
      browserSettingsNote.style.display = 'none';
      pwaSettingsNote.style.display = 'none';
    }
  };

  // 토글 변경 핸들러
  pushToggle.addEventListener('ionChange', async (event: CustomEvent) => {
    const enabled = event.detail.checked;

    if (enabled) {
      // 푸시 알림 활성화
      if (!options.firebaseApp) {
        console.error('[Settings] Firebase app not initialized');
        pushToggle.checked = false;
        return;
      }

      pushToggle.disabled = true;
      try {
        const token = await initializePushNotifications(options.firebaseApp);
        if (!token) {
          pushToggle.checked = false;
        }
      } catch (err) {
        console.error('[Settings] Failed to enable push:', err);
        pushToggle.checked = false;
      } finally {
        updatePushUI();
      }
    } else {
      // 푸시 알림 비활성화
      const token = getCurrentFcmToken();
      if (token) {
        try {
          await unregisterFcmToken(token);
        } catch (err) {
          console.error('[Settings] Failed to unregister token:', err);
        }
      }
      clearFcmToken();
      updatePushUI();
    }
  });

  // 알림 섹션
  const notificationsSection = el('ion-list',
    el('ion-list-header',
      el('ion-label', { style: { fontWeight: '600' } }, 'Notifications')
    ),
    el('ion-item',
      el('ion-icon', {
        name: 'notifications-outline',
        slot: 'start',
        style: { color: '#C1A87D' }
      }),
      el('ion-label',
        el('h2', 'Push Notifications'),
        el('p', { style: { fontSize: '0.875rem', color: 'var(--ion-color-medium)' } },
          'Receive notifications for notices and updates'
        )
      ),
      pushToggle
    ),
    deniedNote,
    browserSettingsNote,
    pwaSettingsNote
  );

  // 정보 섹션
  const infoSection = el('ion-list',
    el('ion-list-header',
      el('ion-label', { style: { fontWeight: '600' } }, 'About')
    ),
    el('ion-item', { lines: 'none' },
      el('ion-icon', {
        name: 'information-circle-outline',
        slot: 'start',
        style: { color: '#C1A87D' }
      }),
      el('ion-label',
        el('h2', 'Valhalla'),
        el('p', { style: { fontSize: '0.875rem', color: 'var(--ion-color-medium)' } },
          'Version 1.0.0'
        )
      )
    )
  );

  const content = el('ion-content', {
    style: { '--background': 'var(--ion-background-color)' } as any
  },
    el('div', {
      style: {
        padding: '1rem',
        maxWidth: '600px',
        margin: '0 auto'
      }
    },
      notificationsSection,
      infoSection
    )
  );

  wrapper.append(header, content);

  // 초기 UI 상태 설정
  requestAnimationFrame(() => {
    updatePushUI();
  });

  return {
    el: wrapper,
    remove() {
      wrapper.remove();
    }
  };
}

export { createAppSettingsView };
