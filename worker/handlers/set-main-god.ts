import { z } from 'zod';
import { jsonWithCors, verifyToken } from "@gaiaprotocol/worker-common";

const mainGodSchema = z.object({
  god_id: z.string().max(100),
});

export async function handleSetMainGod(request: Request, env: Env): Promise<Response> {
  try {
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

    const json = await request.json();
    const parseResult = mainGodSchema.safeParse(json);
    if (!parseResult.success) {
      return jsonWithCors({ error: parseResult.error.message }, 400);
    }

    const { god_id } = parseResult.data;
    const now = Math.floor(Date.now() / 1000);

    // Remove from other accounts if in use
    await env.DB.prepare(`
      DELETE FROM main_god
      WHERE god_id = ? AND account != ?
    `).bind(god_id, account).run();

    // Insert or update
    await env.DB.prepare(`
      INSERT INTO main_god (account, god_id, selected_at)
      VALUES (?, ?, ?)
      ON CONFLICT(account) DO UPDATE
      SET god_id = excluded.god_id,
          selected_at = excluded.selected_at
    `).bind(
      account,
      god_id,
      now
    ).run();

    return jsonWithCors({ success: true });
  } catch (err) {
    console.error(err);
    return jsonWithCors(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
}
