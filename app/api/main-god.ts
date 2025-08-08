import { tokenManager } from "@gaiaprotocol/client-common";

declare const API_BASE_URI: string; // ex) "https://api.example.com"

interface MainGodData {
  god_id?: string;
  selected_at?: number;
}

/**
 * Get the main god for a specific account address.
 */
async function fetchMainGod(): Promise<MainGodData> {
  const res = await fetch(`${API_BASE_URI}/get-main-god`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'authorization': `Bearer ${tokenManager.getToken()}`,
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`fetchMainGod failed: ${res.status} ${res.statusText}`, text);
    throw new Error(`Failed to fetch main god: ${res.status}`);
  }

  const data: MainGodData = await res.json();
  return data;
}

/**
 * Set the main god for the currently authenticated account.
 * Requires a Bearer token.
 */
async function setMainGod(godId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE_URI}/set-main-god`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': `Bearer ${tokenManager.getToken()}`,
    },
    body: JSON.stringify({ god_id: godId })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`setMainGod failed: ${res.status} ${res.statusText}`, text);
    throw new Error(`Failed to set main god: ${res.status}`);
  }

  return res.json();
}

export { fetchMainGod, setMainGod };
