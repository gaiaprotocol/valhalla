import { jsonWithCors } from '@gaiaprotocol/worker-common'
import { readSession } from './utils'

export async function handleGoogleMe(request: Request, env: Env) {
  const me = await readSession(env, request)
  if (!me) return jsonWithCors({ error: 'not_logged_in' }, 401)
  return jsonWithCors({ ok: true, user: me }, 200)
}
