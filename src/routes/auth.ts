import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { query } from "../lib/db.js";
import { authenticateToken, isEnvAdmin, JWT_SECRET } from "../middleware/auth.js";

const router = Router();

router.get("/init", async (req, res) => {
  const sessionId = uuidv4();
  try {
    await query("INSERT INTO auth_sessions (id, status) VALUES ($1, 'pending')", [sessionId]);
    res.json({ sessionId });
  } catch (err) {
    console.error("Auth init error:", err);
    res.status(500).json({ error: "Failed to init auth" });
  }
});

router.get("/check/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  try {
    const result = await query("SELECT * FROM auth_sessions WHERE id = $1", [sessionId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Session not found" });

    const session = result.rows[0];
    if (session.status === 'authorized') {
      const decoded: any = jwt.decode(session.jwt);
      const userObj = {
        id: session.telegram_id,
        username: session.username,
        first_name: session.first_name,
        is_admin: decoded?.is_admin || isEnvAdmin(session.telegram_id)
      };
      res.json({
        status: 'authorized',
        token: session.jwt,
        user: userObj
      });
      await query("DELETE FROM auth_sessions WHERE id = $1", [sessionId]);
    } else {
      res.json({ status: 'pending' });
    }
  } catch (err) {
    console.error("Auth check error:", err);
    res.status(500).json({ error: "Check failed" });
  }
});

router.get("/check", authenticateToken, async (req: any, res) => {
  try {
    const userId = String(req.user.id);
    console.log(`🔍 Auth check for user: ${userId} (${req.user.username})`);

    let userRes = await query("SELECT * FROM users WHERE telegram_id = $1", [userId]);

    if (userRes.rows.length === 0) {
      console.log(`👤 User ${userId} not found in DB, attempting to create...`);
      try {
        await query(
          "INSERT INTO users (telegram_id, username, first_name) VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name",
          [userId, req.user.username || '', req.user.first_name || 'Worker']
        );
        userRes = await query("SELECT * FROM users WHERE telegram_id = $1", [userId]);
      } catch (insertErr) {
        console.error(`❌ Failed to insert/update user ${userId}:`, insertErr);
        // Fallback to minimal user object if DB is down or locked
      }
    }

    const dbUser = userRes?.rows[0];
    if (dbUser) {
      console.log(`✅ User ${userId} hydrated from DB`);
      res.json({
        user: {
          ...dbUser,
          id: dbUser.telegram_id,
          is_admin: isEnvAdmin(req.user.id) || dbUser.is_admin === true
        }
      });
    } else {
      console.warn(`⚠️ Using fallback user for ${userId} (not in DB)`);
      res.json({
        user: {
          ...req.user,
          is_admin: isEnvAdmin(req.user.id)
        }
      });
    }
  } catch (err) {
    console.error("Hydration Error:", err);
    res.json({
      user: {
        ...req.user,
        is_admin: isEnvAdmin(req.user.id)
      }
    });
  }
});

router.post("/telegram", async (req, res) => {
  const { hash, ...data } = req.body;
  if (!hash) return res.status(400).json({ error: "No hash provided" });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(500).json({ error: "Bot token not configured" });

  const secretKey = crypto.createHash("sha256").update(token).digest();
  const dataCheckString = Object.keys(data)
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join("\n");

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash !== hash) {
    return res.status(401).json({ error: "Invalid hash" });
  }

  const authDate = Number(data.auth_date);
  if (Date.now() / 1000 - authDate > 86400) {
    return res.status(401).json({ error: "Auth data expired" });
  }

  const dbUserRes = await query("SELECT is_admin FROM users WHERE telegram_id = $1", [String(data.id)]);
  const isAdminInDb = dbUserRes.rows[0]?.is_admin === true;
  const adminStatus = isEnvAdmin(data.id) || isAdminInDb;
  const userPayload = { ...data, is_admin: adminStatus };
  const jwtToken = jwt.sign({ id: String(data.id), username: data.username, is_admin: adminStatus }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token: jwtToken, user: userPayload });
});

export default router;
