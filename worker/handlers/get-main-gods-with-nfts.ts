// handlers/get-main-gods-with-nfts.ts
import { jsonWithCors } from '@gaiaprotocol/worker-common';
import { z } from 'zod';

const MAIN_GOD_TABLE = 'main_god';
// 같은 워커에서 쓰는 컬렉션 주소가 고정이면 그대로 사용
const NFT_ADDRESS = '0x134590ACB661Da2B318BcdE6b39eF5cF8208E372';

type MainGodRow = { account: string; god_id: string; selected_at: number };

type NftItem = {
  nft_address: string;
  token_id: number;
  holder: string;
  type?: string | null;
  gender?: string | null;
  parts?: string | null;
  image?: string | null;
};

export async function handleGetMainGodsWithNfts(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      return jsonWithCors({ error: 'Method Not Allowed' }, 405);
    }

    const body = await request.json().catch(() => ({}));

    const schema = z.object({
      addresses: z.array(
        z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
      ).nonempty('addresses must not be empty'),
    });

    const { addresses } = schema.parse(body);

    // 1) main_god 테이블에서 해당 주소들의 메인 갓 조회
    const placeholders = addresses.map(() => '?').join(', ');
    const stmt = `
      SELECT account, god_id, selected_at
      FROM ${MAIN_GOD_TABLE}
      WHERE account IN (${placeholders})
    `;

    const { results } = await env.DB.prepare(stmt).bind(...addresses).all<MainGodRow>();
    const rows: MainGodRow[] = results ?? [];

    if (rows.length === 0) {
      // get-names와 동일 정책: 존재하는 항목만 반환
      return jsonWithCors([], 200);
    }

    // 2) god_id → token_id 배열 구성
    const tokenIds = Array.from(
      new Set(
        rows
          .map(r => r.god_id)
          .filter(n => Number.isFinite(Number(n)))
      )
    );

    // tokenIds가 없으면 바로 빈 NFT로 합쳐서 반환
    if (tokenIds.length === 0) {
      const items = rows.map(r => ({
        address: r.account,
        god_id: r.god_id,
        selected_at: r.selected_at,
        nft: null as NftItem | null,
      }));
      return jsonWithCors(items, 200);
    }

    const byTokenId = await (env.API_WORKER as any).fetchNftDataByIds(tokenIds);

    // 4) 병합하여 반환
    const items = rows.map(r => {
      const tid = Number(r.god_id);
      return {
        address: r.account,
        god_id: r.god_id,
        selected_at: r.selected_at,
        nft: Number.isFinite(tid) ? (byTokenId[`gaia-protocol-gods:${tid}`] ?? null) : null,
      };
    });

    return jsonWithCors(items, 200);
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
