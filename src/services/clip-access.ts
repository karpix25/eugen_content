import { query } from "../lib/db.js";
import { isEnvAdmin } from "../middleware/auth.js";

export const buildClipAccessCondition = (userParamRef: string) => (
  `(c.is_public = true OR ch.is_public = true OR v.is_public = true OR ch.user_id = ${userParamRef} OR (v.channel_id IS NULL AND v.user_id = ${userParamRef}))`
);

export const resolveUserAdminAccess = async (
  userId: string | number,
  jwtIsAdmin: boolean = false
) => {
  const normalizedUserId = String(userId);

  if (isEnvAdmin(normalizedUserId) || jwtIsAdmin) {
    return true;
  }

  try {
    const result = await query("SELECT is_admin FROM users WHERE telegram_id = $1", [normalizedUserId]);
    return result.rows[0]?.is_admin === true;
  } catch (err) {
    console.error("Clip access admin resolution failed:", err);
    return false;
  }
};

export const getAccessibleClipById = async (
  clipId: string,
  userId: string | number,
  jwtIsAdmin: boolean = false
) => {
  const normalizedUserId = String(userId);
  const isAdmin = await resolveUserAdminAccess(normalizedUserId, jwtIsAdmin);

  let queryText = `
    SELECT c.*,
           v.title as video_title,
           v.thumbnail as video_thumbnail,
           v.is_public as video_is_public,
           ch.is_public as channel_is_public,
           ch.user_id as channel_user_id,
           v.user_id as video_user_id
    FROM clips c
    JOIN videos v ON c.video_id = v.id
    LEFT JOIN channels ch ON v.channel_id = ch.id
    WHERE c.id = $1
  `;
  const params: any[] = [clipId];

  if (!isAdmin) {
    queryText += ` AND ${buildClipAccessCondition("$2")}`;
    params.push(normalizedUserId);
  }

  queryText += " LIMIT 1";

  const result = await query(queryText, params);
  return result.rows[0] || null;
};

export const listAccessibleProcessedClips = async (
  userId: string | number,
  jwtIsAdmin: boolean = false,
  options: { requireAvailable?: boolean } = {}
) => {
  const normalizedUserId = String(userId);
  const isAdmin = await resolveUserAdminAccess(normalizedUserId, jwtIsAdmin);
  const requireAvailable = options.requireAvailable !== false;

  let queryText = `
    SELECT c.id, c.title, c.url, c.source_url, c.processed_url
    FROM clips c
    JOIN videos v ON c.video_id = v.id
    LEFT JOIN channels ch ON v.channel_id = ch.id
    WHERE c.status = 'processed'
  `;
  const params: any[] = [];

  if (requireAvailable) {
    queryText += " AND c.is_available = TRUE";
  }

  if (!isAdmin) {
    params.push(normalizedUserId);
    queryText += ` AND ${buildClipAccessCondition("$1")}`;
  }

  queryText += " ORDER BY c.created_at DESC";

  const result = await query(queryText, params);
  return result.rows;
};
