import { TokenManager } from './token-mananger';

export async function validateToken(): Promise<boolean> {
  const token = TokenManager.getToken();
  if (!token) return false;

  const res = await fetch('/api/validate-token', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    TokenManager.clear();
    return false;
  }

  return true;
}
