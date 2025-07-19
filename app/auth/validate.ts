import { TokenManager } from './token';

export async function validateToken(): Promise<boolean> {
  const token = TokenManager.get();
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
