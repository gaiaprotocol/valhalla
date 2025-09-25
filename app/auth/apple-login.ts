import { logoutApple, verifyAppleLogin } from "../api/apple";
import { isWebView, platform } from "../platform";

declare const API_BASE_URI: string;

const APPLE_LOGIN_PATH = `${API_BASE_URI}/apple-login`;

type AppleSignInCompleteDetail = {
  idToken: string;
  nonce?: string;
  state?: string;
  email?: string;
  user?: unknown;
  message?: string;
};

type AppleSignInFailedDetail = {
  code?: string;
  message?: string;
};

declare global {
  interface Window {
    Native?: {
      signInWithApple?: () => void;
      signOutFromApple?: () => void;
    };
    Android?: {
      signInWithApple?: () => void;
      signOutFromApple?: () => void;
    };
  }
}

export function appleLogin() {
  // WebView(네이티브 브릿지) 우선
  if (isWebView && (window as any).Native?.signInWithApple) {
    (window as any).Native.signInWithApple();
  } else if (isWebView && (window as any).Android?.signInWithApple) {
    (window as any).Android.signInWithApple();
  } else {
    // 브라우저 환경: 서버 라우트로 리디렉션 → 서버에서 애플 OAuth/SIWA 진행
    location.href = APPLE_LOGIN_PATH;
  }
}

let appleSignOutResolve: (() => void) | undefined;

export async function appleLogout() {
  if (isWebView && (window as any).Native?.signOutFromApple) {
    (window as any).Native.signOutFromApple();
    return new Promise<void>((resolve) => (appleSignOutResolve = resolve));
  } else if (isWebView && (window as any).Android?.signOutFromApple) {
    (window as any).Android.signOutFromApple();
    return new Promise<void>((resolve) => (appleSignOutResolve = resolve));
  } else {
    await logoutApple();
  }
}

if (isWebView) {
  // 로그인 성공 콜백 (네이티브에서 디스패치)
  window.addEventListener("appleSignInComplete", async (e: any) => {
    const detail: AppleSignInCompleteDetail = e.detail || {};
    const { idToken, nonce, state } = detail;

    try {
      // 서버에서 Apple 공개키(JWKS)로 ID 토큰 검증 + nonce/state 검증 + aud(=Service ID) 검증 필수
      const { ok } = await verifyAppleLogin({
        provider: "apple",
        idToken,
        nonce,
        state,
      });

      if (ok) {
        location.href = `/?platform=${platform}&source=webview`;
      } else {
        const toast = document.createElement("ion-toast");
        toast.message = `Apple sign-in failed. ${e.detail?.message || ""}`;
        toast.duration = 1600;
        toast.position = "bottom";
        document.body.appendChild(toast);
        (toast as any).present();
      }
    } catch (error: any) {
      const toast = document.createElement("ion-toast");
      toast.message = `Apple sign-in failed. ${error?.message || ""}`;
      toast.duration = 1600;
      toast.position = "bottom";
      document.body.appendChild(toast);
      (toast as any).present();
    }
  });

  // 로그인 실패 콜백
  window.addEventListener("appleSignInFailed", (e: any) => {
    console.warn("Apple sign-in failed", e.detail);

    const detail: AppleSignInFailedDetail = e.detail || {};
    const toast = document.createElement("ion-toast");
    toast.message = `Apple sign-in failed. ${detail.message || ""}`;
    toast.duration = 1600;
    toast.position = "bottom";
    document.body.appendChild(toast);
    (toast as any).present();
  });

  // 로그아웃 완료 콜백
  window.addEventListener("appleSignOutComplete", () => {
    appleSignOutResolve?.();
  });

  // 로그아웃 실패 콜백
  window.addEventListener("appleSignOutFailed", (e: any) => {
    console.error("Apple sign-out failed:", e.detail?.message);

    const toast = document.createElement("ion-toast");
    toast.message = `Apple sign-out failed. ${e.detail?.message || ""}`;
    toast.duration = 1600;
    toast.position = "bottom";
    document.body.appendChild(toast);
    (toast as any).present();
  });
}
