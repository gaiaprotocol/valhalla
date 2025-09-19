import { logoutGoogle } from "../api/google";
import { isWebView, platform } from "../platform";

declare const API_BASE_URI: string;

const GOOGLE_LOGIN_PATH = `${API_BASE_URI}/google-login`;

export function googleLogin() {
  if (isWebView && (window as any).Android?.signInWithGoogle) {
    (window as any).Android.signInWithGoogle()
  } else {
    location.href = GOOGLE_LOGIN_PATH
  }
}

let signOutResolve: (() => void) | undefined;
export async function googleLogout() {
  await Promise.all([
    logoutGoogle(),
    (() => {
      if (isWebView && (window as any).Android?.signOutFromGoogle) {
        (window as any).Android.signOutFromGoogle()
        return new Promise<void>(resolve => signOutResolve = resolve)
      }
    })()
  ])
}

if (isWebView) {
  window.addEventListener('googleSignInComplete', async (e: any) => {
    const { idToken, nonce } = e.detail
    // 서버에서 구글 공개키로 ID 토큰 검증 + nonce 검증 + aud(=WEB_CLIENT_ID) 검증 필수
    await fetch(`${API_BASE_URI}/oauth2/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider: 'google', idToken, nonce })
    })
    location.href = `/?platform=${platform}&source=webview`;
  })

  window.addEventListener('googleSignInFailed', (e: any) => {
    console.warn('Google sign-in failed', e.detail)

    const toast = document.createElement("ion-toast");
    toast.message = `Google sign-in failed. ${e.detail.message}`;
    toast.duration = 1600;
    toast.position = "bottom";
    document.body.appendChild(toast);
    (toast as any).present();
  })

  window.addEventListener('googleSignOutComplete', () => {
    signOutResolve?.()
  });

  window.addEventListener('googleSignOutFailed', (e: any) => {
    console.error('Sign-out failed:', e.detail?.message);

    const toast = document.createElement("ion-toast");
    toast.message = `Google sign-out failed. ${e.detail.message}`;
    toast.duration = 1600;
    toast.position = "bottom";
    document.body.appendChild(toast);
    (toast as any).present();
  });
}
