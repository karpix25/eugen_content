
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || "";
const JWT_SECRET = process.env.JWT_SECRET || 
  crypto.createHash("sha256").update(token).digest("hex");

const adminId = "38061745";
const jwtToken = jwt.sign({ 
    id: adminId, 
    username: "nadaraya", 
    is_admin: true 
}, JWT_SECRET, { expiresIn: '7d' });

console.log(jwtToken);
