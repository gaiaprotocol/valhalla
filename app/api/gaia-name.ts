import { getAddress } from 'viem';

declare const GAIA_API_BASE_URI: string;

export async function fetchGaiaNames(
  addresses: string[],
): Promise<Record<string, string>> {
  if (addresses.length === 0) return {};

  const normalized = addresses.map(getAddress);

  const res = await fetch(`${GAIA_API_BASE_URI}/get-names`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses: normalized })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`fetchGaiaNames failed: ${res.status} ${res.statusText}`, text);
    throw new Error(`Failed to fetch Gaia names: ${res.status}`);
  }

  const names: { address: string; name: string }[] = await res.json();

  const result: Record<string, string> = {};
  for (const { address, name } of names) {
    result[getAddress(address)] = name;
  }

  return result;
}
