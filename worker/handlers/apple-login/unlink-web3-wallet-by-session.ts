import { readSession } from '../utils'

export async function handleUnlinkAppleWeb3WalletBySession(request: Request, env: Env): Promise<Response> {
  try {
    const me = await readSession(env, request)
    if (!me?.sub) return Response.json({ error: 'not_logged_in' }, { status: 401 })

    const result = await env.DB.prepare(
      `DELETE FROM apple_web3_accounts WHERE apple_sub = ?`
    ).bind(me.sub).run()

    return Response.json({ ok: true, deleted: result.meta.changes ?? 0 })
  } catch (err) {
    console.error(err)
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
