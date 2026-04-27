const SHOTS_SELECT_SQL =
  "SELECT id, created_at, shot_ms, brew_counter, avg_ms, payload FROM shots ORDER BY created_at DESC, brew_counter DESC, id DESC LIMIT ?";

export async function listShots(env, limit) {
  const { results } = await env.DB.prepare(SHOTS_SELECT_SQL).bind(limit).all();
  return results;
}
