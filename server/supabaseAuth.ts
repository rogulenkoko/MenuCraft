import type { RequestHandler, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

interface SupabaseUser {
  sub: string;
  id: string; // Alias for sub (user ID)
  email?: string;
  aud: string;
  role: string;
  exp: number;
  user_metadata?: {
    avatar_url?: string;
    full_name?: string;
    name?: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      supabaseUser?: SupabaseUser;
    }
  }
}

export const verifySupabaseToken: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "No authorization token provided" });
    }

    const token = authHeader.substring(7);

    if (!SUPABASE_JWT_SECRET) {
      console.error("SUPABASE_JWT_SECRET not configured");
      return res.status(500).json({ message: "Server configuration error" });
    }

    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET) as SupabaseUser;
    
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ message: "Token expired" });
    }

    // Set id as alias for sub (Supabase user ID)
    decoded.id = decoded.sub;
    req.supabaseUser = decoded;
    next();
  } catch (error: any) {
    console.error("Token verification failed:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};
