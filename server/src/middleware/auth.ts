import type { NextFunction, Request, Response } from "express";
import type { User } from "../generated/prisma/client.js";
import { firebaseAuth } from "../lib/firebase.js";
import { prisma } from "../lib/prisma.js";

declare global {
  namespace Express {
    interface Request {
      user: User;
    }
  }
}

/**
 * Verifies the Firebase ID token from `Authorization: Bearer <token>`,
 * then upserts a local User row so the rest of the API can use our own ids.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);
    const email = decoded.email ?? `${decoded.uid}@no-email.local`;
    const fallbackName = decoded.name ?? email.split("@")[0];

    const user = await prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {},
      create: {
        firebaseUid: decoded.uid,
        email,
        displayName: fallbackName,
        avatarUrl: decoded.picture ?? null,
      },
    });
    req.user = user;
    next();
  } catch (err) {
    console.warn("Token verification failed", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
