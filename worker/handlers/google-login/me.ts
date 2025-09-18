import { readSession } from './utils'

export async function handleGoogleMe(request: Request, env: Env) {
  try {
    const me = await readSession(env, request)
    if (!me?.sub) return Response.json({ error: 'not_logged_in' }, { status: 401 })

    const row = await env.DB.prepare(
      `SELECT wallet_address, token
       FROM google_web3_accounts
       WHERE google_sub = ?`
    )
      .bind(me.sub)
      .first<{ wallet_address: string | null; token: string | null }>()

    return Response.json(
      {
        ok: true,
        user: me,
        wallet_address: row?.wallet_address ?? null,
        token: row?.token ?? null,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
