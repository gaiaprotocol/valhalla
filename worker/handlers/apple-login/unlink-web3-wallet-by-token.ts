import { verifyToken } from '@gaiaprotocol/worker-common'
import { getAddress } from 'viem'

export async function handleUnlinkAppleWeb3WalletByToken(request: Request, env: Env): Promise<Response> {
  try {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 })

    const token = auth.slice(7)
    const payload = await verifyToken(token, env)
    if (!payload?.sub) return new Response('Unauthorized', { status: 401 })

    const normalizedAddress = getAddress(payload.sub)
    const result = await env.DB.prepare(
      `DELETE FROM apple_web3_accounts WHERE wallet_address = ?`
    ).bind(normalizedAddress).run()

    return Response.json({ ok: true, deleted: result.meta.changes ?? 0 })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
