const isWebView = new URLSearchParams(window.location.search).get('source') === 'webview';

const GOOGLE_LOGIN_PATH = '/api/google-login';

export function googleLogin() {
  if (isWebView) {
    (window as any).Android.signInWithGoogle()
  } else {
    location.href = GOOGLE_LOGIN_PATH
  }
}

if (isWebView) {
  window.addEventListener('googleSignInComplete', async (e: any) => {
    const { idToken, nonce } = e.detail
    // 서버에서 구글 공개키로 ID 토큰 검증 + nonce 검증 + aud(=WEB_CLIENT_ID) 검증 필수
    await fetch('/api/oauth2/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ provider: 'google', idToken, nonce })
    })
    location.href = '/';
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
}
