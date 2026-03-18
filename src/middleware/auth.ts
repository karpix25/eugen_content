import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query } from "../lib/db.js";

const token = process.env.TELEGRAM_BOT_TOKEN || "";
export const JWT_SECRET = process.env.JWT_SECRET || 
  crypto.createHash("sha256").update(token).digest("hex");

if (!token && !process.env.JWT_SECRET) {
  console.warn("WARNING: Neither TELEGRAM_BOT_TOKEN nor JWT_SECRET is defined. Authentication will fail.");
}

export interface AuthUser {
  id: string | number;
  username?: string;
  first_name?: string;
  is_admin?: boolean;
}

export const isEnvAdmin = (telegramId: string | number): boolean => {
  const tid = String(telegramId);
  if (tid === 'dev') return true;

  // Check plural IDs
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "").split(",").map(id => id.trim());
  if (adminIds.includes(tid)) return true;

  // Check singular ID
  const singleAdminId = (process.env.ADMIN_TELEGRAM_ID || "").trim();
  if (singleAdminId && tid === singleAdminId) return true;

  return false;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  if (!JWT_SECRET) return res.status(500).json({ error: "Server authentication misconfigured" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user as AuthUser;
    next();
  });
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.sendStatus(401);
  
  // 1. Check environment variables (master override)
  if (isEnvAdmin(req.user.id)) return next();
  
  // 2. Check JWT payload
  if (req.user.is_admin) return next();
  
  // 3. Check database (real-time fallback)
  try {
    const result = await query("SELECT is_admin FROM users WHERE telegram_id = $1", [String(req.user.id)]);
    if (result.rows[0]?.is_admin === true) {
      return next();
    }
  } catch (err) {
    console.error("Admin check database error:", err);
  }

  res.sendStatus(403);
};
