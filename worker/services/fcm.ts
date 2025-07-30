import { EnhancedFcmMessage, FCM, FcmOptions } from 'fcm-cloudflare-workers';

class FcmManager {
  #fcm: FCM;

  constructor(env: Env) {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const fcmOptions = new FcmOptions({
      serviceAccount,
      kvStore: env.FCM_TOKEN_CACHE,
      kvCacheKey: 'fcm_access_token',
    });
    this.#fcm = new FCM(fcmOptions);
  }

  async sendToToken(token: string, msg: {
    title: string;
    body: string;
    icon?: string;
    data?: Record<string, string>;
  }) {
    const message: EnhancedFcmMessage = {
      notification: {
        title: 'New Message',
        body: 'You have a new message!',
        image: 'https://example.com/image.png'
      },
      data: {
        key: 'value',
      },
      // Optional platform-specific configurations
      android: {
        notification: {
          click_action: 'OPEN_MESSAGE',
          channel_id: 'messages',
          icon: 'message_icon'
        }
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default'
          }
        }
      },
      webpush: {
        notification: {
          icon: 'https://example.com/icon.png',
          badge: 'https://example.com/badge.png',
          actions: [
            {
              action: 'view',
              title: 'View Message'
            }
          ]
        }
      }
    };

    await this.#fcm.sendToToken(message, token);
  }
}

export { FcmManager };
