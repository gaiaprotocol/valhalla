import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare const self: ServiceWorkerGlobalScope;

const firebaseApp = initializeApp({
  apiKey: 'AIzaSyD21Q4smrSlTxs-FucpGnW2FX_br1rm0HA',
  authDomain: 'gaia-valhalla.firebaseapp.com',
  projectId: 'gaia-valhalla',
  storageBucket: 'gaia-valhalla.firebasestorage.app',
  messagingSenderId: '797829770593',
  appId: '1:797829770593:web:ac557a31562d0c8bd26920',
  measurementId: 'G-GP4SH06LSL'
});

let messaging: ReturnType<typeof getMessaging> | null = null;
try {
  messaging = getMessaging(firebaseApp);
} catch (err) {
  console.error('Failed to initialize Firebase Messaging', err);
}

// 백그라운드 메시지 핸들러
if (messaging) {
  onBackgroundMessage(messaging, (payload) => {
    console.log('[SW] Background message received:', payload);

    const notificationTitle = payload.notification?.title || 'Valhalla';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: payload.notification?.image || '/images/icon-192x192.png',
      badge: '/images/icon-192x192.png',
      tag: payload.data?.type === 'notice' ? `notice-${payload.data?.noticeId}` : 'valhalla-notification',
      data: payload.data,
      requireInteraction: true,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// 알림 클릭 핸들러
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification click:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // 알림 데이터에서 이동할 경로 결정
  const data = event.notification.data || {};
  let targetUrl = '/';

  if (data.type === 'notice') {
    targetUrl = '/notices';
  } else if (data.clickAction) {
    targetUrl = data.clickAction;
  }

  // 기존 탭이 있으면 포커스, 없으면 새 탭 열기
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 같은 origin의 탭 찾기
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            payload: { targetUrl, data },
          });
          return;
        }
      }

      // 열린 탭이 없으면 새 탭 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 푸시 이벤트 핸들러 (Firebase가 처리하지 않는 경우를 위한 폴백)
self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push event received');

  if (!event.data) {
    console.log('[SW] Push event has no data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('[SW] Push data:', data);

    // Firebase SDK가 처리하지 않은 경우에만 직접 알림 표시
    if (!data.notification) {
      const title = data.title || 'Valhalla';
      const options: NotificationOptions = {
        body: data.body || '',
        icon: '/images/icon-192x192.png',
        badge: '/images/icon-192x192.png',
        data: data,
      };

      event.waitUntil(self.registration.showNotification(title, options));
    }
  } catch (err) {
    console.error('[SW] Error parsing push data:', err);
  }
});

// Service Worker 설치 시 즉시 활성화
self.addEventListener('install', () => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});
