import { tokenManager } from '@gaiaprotocol/client-common';
import type { ElementType, GenderType } from '@gaiaprotocol/god-mode-shared';

declare const GAIA_API_BASE_URI: string;

function toGodMetadata(data: any): {
  type: ElementType; gender: GenderType; parts: Record<string, string>;
} {
  const type = data?.traits?.Type as ElementType;
  const gender = data?.traits?.Gender as GenderType;
  const parts = (data?.parts ?? {}) as Record<string, string>;

  if (!type || !gender) throw new Error('Type/Gender is missing.');
  return { type, gender, parts };
}

export async function saveNftAttributes(id: string | number, data: any) {
  const metadata = toGodMetadata(data);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = tokenManager.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${GAIA_API_BASE_URI}/save-metadata`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id, ...metadata }),
  });

  if (!res.ok) {
    let msg = `Failed to save (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { }
    throw new Error(msg);
  }

  return res;
}
