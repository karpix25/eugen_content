import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

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

export const isAdmin = (telegramId: string | number): boolean => {
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

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.sendStatus(401);
  if (!isAdmin(req.user.id)) return res.sendStatus(403);
  next();
};
