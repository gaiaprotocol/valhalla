import { jsonWithCors } from '@gaiaprotocol/worker-common'
import { readSession } from './utils'

export async function handleGoogleMe(request: Request, env: Env) {
  try {
    const me = await readSession(env, request)
    if (!me?.sub) return jsonWithCors({ error: 'not_logged_in' }, 401)

    const row = await env.DB.prepare(
      `SELECT wallet_address, token
       FROM google_web3_accounts
       WHERE google_sub = ?`
    )
      .bind(me.sub)
      .first<{ wallet_address: string | null; token: string | null }>()

    return jsonWithCors(
      {
        ok: true,
        user: me,
        wallet_address: row?.wallet_address ?? null,
        token: row?.token ?? null,
      },
      200
    )
  } catch (err) {
    console.error(err)
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    )
  }
}
