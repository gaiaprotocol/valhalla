import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";

export async function handleGetMainGod(request: Request, env: Env): Promise<Response> {
  try {
    // Authorization check
    const auth = request.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) {
      return jsonWithCors('Unauthorized', 401);
    }

    const token = auth.slice(7);
    const payload = await verifyToken(token, env);
    if (!payload?.sub) {
      return jsonWithCors('Unauthorized', 401);
    }

    const account = payload.sub;

    // Query current user's main god
    const { results } = await env.DB.prepare(`
      SELECT god_id, selected_at
      FROM main_god
      WHERE account = ?
      LIMIT 1
    `)
      .bind(account)
      .all<{ god_id: string; selected_at: number }>();

    const row = results?.[0];

    // Return nulls if not set yet
    return jsonWithCors(
      {
        god_id: row?.god_id ?? undefined,
        selected_at: row?.selected_at ?? undefined,
      },
      200
    );
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
