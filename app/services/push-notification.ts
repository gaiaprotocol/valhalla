import { getMessaging, getToken, onMessage, type Messaging, type MessagePayload } from 'firebase/messaging';
import type { FirebaseApp } from 'firebase/app';
import { registerFcmToken } from '../api/fcm';

const VAPID_KEY = 'BGPXUkzHHkFCCnB0qvuEkj3VtJ3eK8z71PvYTorx4xRq9lBaY9BE4knxb1i13Qn49nogLJX9B1zOoX-Gvaj5TjI';

// localStorage 키
const FCM_TOKEN_KEY = 'fcm_token';
const PUSH_PERMISSION_KEY = 'push_permission_asked';

/**
 * 푸시 알림 권한 요청 및 FCM 토큰 등록
 */
export async function initializePushNotifications(app: FirebaseApp): Promise<string | null> {
  // WebView에서는 푸시 알림 불가
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('[Push] Notifications not supported');
    return null;
  }

  // Service Worker 지원 확인
  if (!('serviceWorker' in navigator)) {
    console.log('[Push] Service Worker not supported');
    return null;
  }

  try {
    // Service Worker 등록
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('[Push] Service Worker registered:', registration);

    // 이미 권한이 있거나 거부된 경우
    if (Notification.permission === 'denied') {
      console.log('[Push] Notification permission denied');
      return null;
    }

    // 권한 요청
    if (Notification.permission === 'default') {
      // 이미 물어봤으면 다시 묻지 않음
      const alreadyAsked = localStorage.getItem(PUSH_PERMISSION_KEY);
      if (alreadyAsked) {
        console.log('[Push] Permission already asked, skipping');
        return null;
      }
    }

    let messaging: Messaging;
    try {
      messaging = getMessaging(app);
    } catch (err) {
      console.error('[Push] Failed to get messaging instance:', err);
      return null;
    }

    // FCM 토큰 요청 (권한이 필요하면 자동으로 요청함)
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    localStorage.setItem(PUSH_PERMISSION_KEY, 'true');

    if (!token) {
      console.log('[Push] No FCM token received');
      return null;
    }

    console.log('[Push] FCM token:', token);

    // 기존 토큰과 다르면 서버에 등록
    const existingToken = localStorage.getItem(FCM_TOKEN_KEY);
    if (token !== existingToken) {
      const registered = await registerFcmToken(token, 'web');
      if (registered) {
        localStorage.setItem(FCM_TOKEN_KEY, token);
        console.log('[Push] Token registered to server');
      }
    }

    return token;
  } catch (err) {
    console.error('[Push] Error initializing push notifications:', err);
    localStorage.setItem(PUSH_PERMISSION_KEY, 'true');
    return null;
  }
}

/**
 * 포그라운드 메시지 핸들러 설정
 */
export function setupForegroundMessageHandler(
  app: FirebaseApp,
  onNotification: (payload: MessagePayload) => void,
): (() => void) | null {
  try {
    const messaging = getMessaging(app);

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[Push] Foreground message received:', payload);
      onNotification(payload);
    });

    return unsubscribe;
  } catch (err) {
    console.error('[Push] Error setting up foreground handler:', err);
    return null;
  }
}

/**
 * 현재 FCM 토큰 가져오기
 */
export function getCurrentFcmToken(): string | null {
  return localStorage.getItem(FCM_TOKEN_KEY);
}

/**
 * 푸시 알림 권한 상태 확인
 */
export function getPushPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Service Worker에서 보낸 메시지 수신 핸들러
 */
export function setupServiceWorkerMessageHandler(
  onNavigate: (path: string) => void,
): void {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('[Push] Message from SW:', event.data);

    if (event.data?.type === 'NOTIFICATION_CLICK') {
      const { targetUrl } = event.data.payload;
      if (targetUrl) {
        onNavigate(targetUrl);
      }
    }
  });
}

/**
 * 저장된 FCM 토큰 및 권한 요청 플래그 삭제
 */
export function clearFcmToken(): void {
  localStorage.removeItem(FCM_TOKEN_KEY);
  localStorage.removeItem(PUSH_PERMISSION_KEY);
}
