import { handleGodModeCheck } from '@gaiaprotocol/god-mode-worker';
import { handleGoogleLogin, handleGoogleLogout, handleGoogleMe, handleGoogleMeByWallet, handleLinkGoogleWeb3Wallet, handleLogin, handleNonce, handleOAuth2Callback, handleOAuth2Verify, handleUnlinkGoogleWeb3WalletBySession, handleUnlinkGoogleWeb3WalletByToken, handleUploadImage, handleValidateToken } from '@gaiaprotocol/worker-common';
import { ChatRoom } from './do/chat-room';
import { handleGetMainGodsWithNfts } from './handlers/get-main-gods-with-nfts';
import { handleGetMyMainGod } from './handlers/get-my-main-god';
import { handleSetMainGod } from './handlers/set-main-god';
//import { EnhancedFcmMessage, FCM, FcmOptions } from 'fcm-cloudflare-workers';

export { ChatRoom };

export default {
  async fetch(request, env, ctx): Promise<Response> {
    /*const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const fcmOptions = new FcmOptions({
      serviceAccount,
      kvStore: env.FCM_TOKEN_CACHE,
      kvCacheKey: 'fcm_access_token',
    });
    const fcm = new FCM(fcmOptions);  

    const message: EnhancedFcmMessage = {
      notification: {
        title: 'New Message',
        body: 'You have a new message!',
        //image: 'https://example.com/image.png'
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
          //icon: 'https://example.com/icon.png',
          //badge: 'https://example.com/badge.png',
          actions: [
            {
              action: 'view',
              title: 'View Message'
            }
          ]
        }
      }
    };

    try {
      console.log('Sending message...');
      await fcm.sendToToken(message, 'czPiIUmzVga6GuaMxJvhzV:APA91bGPYi3dH0OtWi6sugZtN6svaX-OrwsO85oZYAM4SiXmSpdMNE2RZyt5WpeWU0xPlhTWCKKVIlcsTcaBkA012vd-XkVaxzyzuSCUW4uPdQLcT00z6Y4');
    } catch (error) {
      console.error('Error sending message:', error);
    }*/

    const url = new URL(request.url);
    if (url.pathname === '/api/nonce' && request.method === 'POST') return handleNonce(request, env);
    if (url.pathname === '/api/login' && request.method === 'POST') return handleLogin(request, 1, env, env.ALLOWED_DOMAIN, env.ALLOWED_URI, env.MESSAGE_FOR_WALLET_LOGIN);
    if (url.pathname === '/api/validate-token' && request.method === 'GET') return handleValidateToken(request, env);
    if (url.pathname === '/api/god-mode' && request.method === 'POST') return handleGodModeCheck(request);
    if (url.pathname === '/api/upload-image' && request.method === 'POST') return handleUploadImage(request, env);
    if (url.pathname === '/api/set-main-god' && request.method === 'POST') return handleSetMainGod(request, env);
    if (url.pathname === '/api/get-my-main-god' && request.method === 'GET') return handleGetMyMainGod(request, env);
    if (url.pathname === '/api/get-main-gods-with-nfts') return handleGetMainGodsWithNfts(request, env);

    // Google Login
    if (url.pathname === '/api/google-login') return handleGoogleLogin(request, env, env.GOOGLE_REDIRECT_URI);
    if (url.pathname === '/api/oauth2/callback') return handleOAuth2Callback(request, env, env.GOOGLE_REDIRECT_URI);
    if (url.pathname === '/api/oauth2/verify') return handleOAuth2Verify(request, env);
    if (url.pathname === '/api/google-me') return handleGoogleMe(request, env);
    if (url.pathname === '/api/google-logout') return handleGoogleLogout(request);
    if (url.pathname === '/api/google-link-web3-wallet' && request.method === 'POST') return handleLinkGoogleWeb3Wallet(request, env);
    if (url.pathname === '/api/google-unlink-web3-wallet-by-token' && request.method === 'POST') return handleUnlinkGoogleWeb3WalletByToken(request, env);
    if (url.pathname === '/api/google-unlink-web3-wallet-by-session' && request.method === 'POST') return handleUnlinkGoogleWeb3WalletBySession(request, env);
    if (url.pathname === '/api/google-me-by-wallet') return handleGoogleMeByWallet(request, env);

    // Apple Login
    /*if (url.pathname === '/api/apple-login') return handleAppleLogin(request, env);
    if (url.pathname === '/api/apple-oauth2/callback') return handleAppleOAuth2Callback(request, env);
    if (url.pathname === '/api/apple-oauth2/verify') return handleAppleOAuth2Verify(request, env);
    if (url.pathname === '/api/apple-me') return handleAppleMe(request, env);
    if (url.pathname === '/api/apple-me-by-wallet') return handleAppleMeByWallet(request, env);
    if (url.pathname === '/api/apple-logout') return handleAppleLogout(request, env);
    if (url.pathname === '/api/apple-link-web3-wallet' && request.method === 'POST') return handleLinkAppleWeb3Wallet(request, env);
    if (url.pathname === '/api/apple-unlink-web3-wallet-by-token' && request.method === 'POST') return handleUnlinkAppleWeb3WalletByToken(request, env);
    if (url.pathname === '/api/apple-unlink-web3-wallet-by-session' && request.method === 'POST') return handleUnlinkAppleWeb3WalletBySession(request, env);*/

    const chatMatch = url.pathname.match(/^\/api\/chat\/([^/]+)\/(stream|send)$/);
    if (chatMatch) {
      const [_, roomId, action] = chatMatch;

      const id = env.CHATROOM.idFromName(roomId);
      const obj = env.CHATROOM.get(id);

      // DO에 요청 위임
      return obj.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
