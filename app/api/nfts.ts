import { NftData } from '@gaiaprotocol/nft-attribute-editor';
import { getAddress } from 'viem';

declare const GAIA_API_BASE_URI: string;

export type HeldNft = {
  collection: string;
  id: number;
  holder: string;
  type?: string | null;
  gender?: string | null;
  parts?: string | null; // JSON string일 수 있음
  image?: string | null; // 상대/절대 경로 모두 가능
};

export type FetchHeldNftsOptions = {
  contract?: string;       // 특정 컬렉션만 필터링할 때
  start?: number;          // 토큰 범위 시작 (백엔드가 지원하면)
  end?: number;            // 토큰 범위 끝
  cursor?: string;         // 페이지네이션 커서(지원 시)
  limit?: number | string; // 페이지 크기(지원 시)
};

/**
 * 지갑 주소가 보유한 NFT 전체를 조회
 * 백엔드 라우팅이 `/{holder}/nfts` (endsWith('/nfts'))인 점을 활용합니다.
 */
export async function fetchHeldNfts(
  holder: string,
  opts: FetchHeldNftsOptions = {}
): Promise<HeldNft[]> {
  if (!holder) return [];

  const normalized = getAddress(holder);
  const url = new URL(`${GAIA_API_BASE_URI}/${normalized}/nfts`);

  // 백엔드가 지원하는 쿼리만 붙여주세요.
  if (opts.contract) url.searchParams.set('contract', getAddress(opts.contract));
  if (opts.start !== undefined) url.searchParams.set('start', String(opts.start));
  if (opts.end !== undefined) url.searchParams.set('end', String(opts.end));
  if (opts.limit !== undefined) url.searchParams.set('limit', String(opts.limit));
  if (opts.cursor) url.searchParams.set('cursor', opts.cursor);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`fetchHeldNfts failed: ${res.status} ${res.statusText}`, text);
    throw new Error(`Failed to fetch held NFTs: ${res.status}`);
  }

  const data = await res.json();
  // 배열 또는 { items, nextCursor } 형태 모두 대응
  const items: HeldNft[] = Array.isArray(data) ? data : (data?.items ?? []);
  return items;
}

/** 선택적으로 토큰 id 목록으로 상세를 받아와야 할 때 (백엔드에 /nfts/by-ids 존재) */
export async function fetchNftsByIds(ids: string[]): Promise<{ id: HeldNft }> {
  const body = { ids };

  const res = await fetch(`${GAIA_API_BASE_URI}/nfts/by-ids`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`fetchNftsByIds failed: ${res.status} ${res.statusText}`, text);
    throw new Error(`Failed to fetch NFTs by ids: ${res.status}`);
  }

  return (await res.json()).results;
}

export type NftDetail = {
  id: string | number;
  image?: string | null;
  name?: string | null;
  description?: string | null;
  holder?: `0x${string}` | null;
} & NftData;

export async function fetchNftDetail(id: string): Promise<NftDetail> {
  const res = await fetch(`${GAIA_API_BASE_URI}/nft/gaia-protocol-gods/${id}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`fetchNftDetail failed: ${res.status} ${res.statusText}`, text);
    throw new Error(`Failed to fetch NFT detail: ${res.status}`);
  }
  return await res.json();
}
