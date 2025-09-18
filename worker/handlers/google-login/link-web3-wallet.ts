import { generateToken, jsonWithCors, validateSiwe } from '@gaiaprotocol/worker-common'
import { getAddress } from 'viem'
import { z } from 'zod'
import { readSession } from './utils'

// address + signature를 받아 토큰을 직접 생성하는 스키마
const linkSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid signature'),
})

// Body: { address, signature }
// 1) 세션 확인 → 2) SIWE 검증 → 3) 토큰 생성 → 4) google_web3_accounts 업서트
export async function handleLinkGoogleWeb3Wallet(
  request: Request,
  chainId: number,     // handleLogin과 동일하게 체인ID 인자로 받게 구성
  env: Env
): Promise<Response> {
  try {
    const me = await readSession(env, request)
    if (!me?.sub) {
      return jsonWithCors({ error: 'not_logged_in' }, 401)
    }

    const body = await request.json()
    const parsed = linkSchema.safeParse(body)
    if (!parsed.success) {
      return jsonWithCors({ error: parsed.error.message }, 400)
    }

    // 1) 주소 정규화
    const normalizedAddress = getAddress(parsed.data.address)

    // 2) SIWE 검증
    const valid = await validateSiwe(
      normalizedAddress,
      parsed.data.signature as `0x${string}`,
      chainId,
      env
    )
    if (!valid) {
      return jsonWithCors('Invalid signature or nonce', 401)
    }

    // 3) 토큰 생성 (주소 기반)
    const token = await generateToken(normalizedAddress, env)

    // 4) DB 업서트
    const now = Math.floor(Date.now() / 1000)
    await env.DB.prepare(`
      INSERT INTO google_web3_accounts (google_sub, wallet_address, token, linked_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(google_sub) DO UPDATE SET
        wallet_address = excluded.wallet_address,
        token          = excluded.token,
        linked_at      = excluded.linked_at
    `)
      .bind(me.sub, normalizedAddress, token, now)
      .run()

    // 클라이언트에서도 바로 쓰게 토큰과 주소를 반환
    return jsonWithCors({ ok: true, wallet_address: normalizedAddress, token })
  } catch (err) {
    console.error(err)
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    )
  }
}
