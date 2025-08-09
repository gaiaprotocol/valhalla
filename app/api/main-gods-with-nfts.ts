import { getAddress } from 'viem';

declare const API_BASE_URI: string;

export type MainGodWithNft = {
  address: string;
  god_id?: string;
  selected_at?: number;
  nft?: {
    nft_address: string;
    token_id: number;
    holder: string;
    type?: string | null;
    gender?: string | null;
    parts?: string | null;
    image?: string | null;
  } | null;
};

/**
 * 여러 주소의 main god NFT 정보를 조회
 */
export async function fetchMainGodsWithNfts(
  addresses: string[],
): Promise<MainGodWithNft[]> {
  if (addresses.length === 0) return [];

  const normalized = addresses.map(getAddress);

  const res = await fetch(`${API_BASE_URI}/get-main-gods-with-nfts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses: normalized }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`fetchMainGodsWithNfts failed: ${res.status} ${res.statusText}`, text);
    throw new Error(`Failed to fetch main gods with NFTs: ${res.status}`);
  }

  const data: MainGodWithNft[] = await res.json();
  return data;
}
