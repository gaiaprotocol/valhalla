import { verifyToken } from '@gaiaprotocol/worker-common'
import { getAddress } from 'viem'

export async function handleAppleMeByWallet(request: Request, env: Env): Promise<Response> {
  try {
    const auth = request.headers.get('authorization')
    if (!auth?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401 })

    const token = auth.slice(7)
    const payload = await verifyToken(token, env)
    if (!payload?.sub) return new Response('Unauthorized', { status: 401 })

    const normalizedAddress = getAddress(payload.sub)

    const row = await env.DB.prepare(
      `SELECT apple_sub, wallet_address, token, linked_at, email, name, picture
       FROM apple_web3_accounts
       WHERE wallet_address = ?`
    ).bind(normalizedAddress).first<{
      apple_sub: string
      wallet_address: string
      token: string
      linked_at: number
      email: string | null
      name: string | null
      picture: string | null
    }>()

    if (!row) {
      return Response.json({ ok: false, error: 'no_account_linked', wallet_address: normalizedAddress }, { status: 404 })
    }

    return Response.json({
      ok: true,
      wallet_address: row.wallet_address,
      apple_sub: row.apple_sub,
      token: row.token,
      linked_at: row.linked_at,
      profile: {
        sub: row.apple_sub,
        email: row.email,
        name: row.name,
        picture: row.picture,
      },
    })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
