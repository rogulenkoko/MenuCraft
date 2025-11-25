import type { RequestHandler, Request, Response, NextFunction } from "express";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

interface SupabaseUser {
  id: string;
  email?: string;
  aud: string;
  role: string;
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

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Supabase configuration missing");
      return res.status(500).json({ message: "Server configuration error" });
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await response.json();
    
    req.supabaseUser = {
      id: user.id,
      email: user.email,
      aud: user.aud,
      role: user.role,
    };
    
    next();
  } catch (error: any) {
    console.error("Token verification failed:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};
