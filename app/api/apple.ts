declare const API_BASE_URI: string;

const APPLE_ME_PATH = `${API_BASE_URI}/apple-me`;
const APPLE_ME_BY_WALLET_PATH = `${API_BASE_URI}/apple-me-by-wallet`;
const APPLE_LOGOUT_PATH = `${API_BASE_URI}/apple-logout`;
const LINK_WALLET_PATH = `${API_BASE_URI}/apple-link-web3-wallet`;
const UNLINK_WALLET_BY_TOKEN_PATH = `${API_BASE_URI}/apple-unlink-web3-wallet-by-token`;
const UNLINK_WALLET_BY_SESSION_PATH = `${API_BASE_URI}/apple-unlink-web3-wallet-by-session`;
const APPLE_VERIFY_PATH = `${API_BASE_URI}/oauth2/verify`; // 서버가 공용 verify 엔드포인트를 쓰는 경우(권장). 별도면 /apple/verify 등으로 변경

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type AppleProfile = {
  sub?: string;       // Apple user identifier
  email?: string;     // Private Relay일 수 있음
  name?: string;      // 최초 동의에서만 올 수 있음
  picture?: string;   // 일반적으로 제공되지 않음(옵션)
};

export type AppleMe = {
  ok?: boolean;
  token?: string;
  wallet_address?: `0x${string}` | null;
  profile?: AppleProfile;
  error?: string;
};

export type AppleMeByWallet = {
  ok?: boolean;
  wallet_address?: `0x${string}`;
  apple_sub?: string;
  token?: string;
  linked_at?: number;
  profile?: AppleProfile;
  error?: string;
};

export type LinkWalletResult = {
  ok?: boolean;
  wallet_address?: `0x${string}`;
  apple_sub?: string;
  token?: string;
  linked_at?: number;
  profile?: AppleProfile;
  error?: string;
};

export type UnlinkWalletResult = {
  ok?: boolean;
  error?: string;
};

export type VerifyPayload = {
  provider: "apple";
  idToken: string;
  // Apple 흐름에서 종종 사용하는 값들(선택)
  nonce?: string;
  state?: string;
};

export type VerifyResult = {
  ok?: boolean;
  token?: string;
  profile?: AppleProfile;
  wallet_address?: `0x${string}` | null;
  error?: string;
};

// ─────────────────────────────────────────────────────────────
// Common fetch helpers (Google 모듈과 동일 구현)
// 필요하면 공용 유틸로 분리하세요.
// ─────────────────────────────────────────────────────────────
async function parseError(res: Response, fallback: string) {
  let message = `${fallback}: ${res.status}`;
  try {
    const data = await res.json();
    if ((data as any)?.error) message = (data as any).error;
  } catch {
    try {
      const text = await res.text();
      if (text) message = text;
    } catch { /* ignore */ }
  }
  throw new Error(message);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) await parseError(res, `GET ${url} failed`);
  return (await res.json()) as T;
}

async function getJsonAuth<T>(url: string, authToken: string): Promise<T> {
  if (!authToken) throw new Error('Missing authorization token.');
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) await parseError(res, `GET ${url} failed`);
  return (await res.json()) as T;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res, `POST ${url} failed`);
  try { return (await res.json()) as T; } catch { return {} as T; }
}

async function postJsonAuth<T>(url: string, authToken: string, body?: unknown): Promise<T> {
  if (!authToken) throw new Error('Missing authorization token.');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res, `POST ${url} failed`);
  try { return (await res.json()) as T; } catch { return {} as T; }
}

async function postJsonWithCreds<T>(
  url: string,
  body?: unknown,
  credentials: RequestCredentials = "include"
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) await parseError(res, `POST ${url} failed`);
  try { return (await res.json()) as T; } catch { return {} as T; }
}

// ─────────────────────────────────────────────────────────────
// Public APIs
// ─────────────────────────────────────────────────────────────

/** 쿠키 세션 기반: 내 세션/토큰/지갑 상태 조회 */
export async function fetchAppleMe(): Promise<AppleMe> {
  return await getJson<AppleMe>(APPLE_ME_PATH);
}

/** 지갑 JWT 기반: 지갑 주소로 연동된 Apple 계정 조회 */
export async function fetchAppleMeByWallet(authToken: string): Promise<AppleMeByWallet> {
  return await getJsonAuth<AppleMeByWallet>(APPLE_ME_BY_WALLET_PATH, authToken);
}

/** 쿠키 세션 기반: 서버 세션 로그아웃 */
export async function logoutApple(): Promise<void> {
  await postJson(APPLE_LOGOUT_PATH);
}

/** 지갑 JWT 기반: Apple 계정과 Web3 지갑 주소 링크 */
export async function linkAppleWeb3Wallet(authToken: string): Promise<LinkWalletResult> {
  // 서버는 바디를 사용하지 않으면 빈 바디
  return await postJsonAuth<LinkWalletResult>(LINK_WALLET_PATH, authToken, {});
}

/** 지갑 JWT 기반: 링크 해제 */
export async function unlinkAppleWeb3WalletByToken(authToken: string): Promise<UnlinkWalletResult> {
  return await postJsonAuth<UnlinkWalletResult>(UNLINK_WALLET_BY_TOKEN_PATH, authToken, {});
}

/** 쿠키 세션 기반: 링크 해제 */
export async function unlinkAppleWeb3WalletBySession(): Promise<UnlinkWalletResult> {
  return await postJson<UnlinkWalletResult>(UNLINK_WALLET_BY_SESSION_PATH);
}

/** ID 토큰 검증 전담: 서버가 Apple ID 토큰/nonce/state 검증 및 세션 수립 */
export async function verifyAppleLogin(payload: VerifyPayload): Promise<VerifyResult> {
  // Google과 동일하게 보안/쿠키 세팅 목적상 credentials: 'include' 유지
  return await postJsonWithCreds<VerifyResult>(APPLE_VERIFY_PATH, payload, "include");
}
