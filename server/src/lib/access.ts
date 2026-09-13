import { prisma } from "./prisma.js";
import { forbidden, notFound } from "./errors.js";

/**
 * Roles:
 *  - ADMIN     — everything: approve members, change roles, invite code, any session, any result.
 *  - ORGANISER — can create game days and manage (edit/delete/seat players on) the ones they created.
 *                Cannot approve members, change roles, or edit other players' results.
 *  - MEMBER    — view, and submit their own result.
 */
export async function requireMember(userId: string, groupId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership) throw notFound("Group not found");
  if (membership.status !== "APPROVED") throw forbidden("Your membership is not approved yet");
  return membership;
}

export async function requireAdmin(userId: string, groupId: string) {
  const membership = await requireMember(userId, groupId);
  if (membership.role !== "ADMIN") throw forbidden("Admin only");
  return membership;
}

/** Admins and organisers may create game days. */
export async function requireOrganiser(userId: string, groupId: string) {
  const membership = await requireMember(userId, groupId);
  if (membership.role !== "ADMIN" && membership.role !== "ORGANISER") throw forbidden("Only admins and organisers can do that");
  return membership;
}

/** Admins may manage any session; organisers only the sessions they created. */
export async function requireSessionManager(userId: string, groupId: string, sessionId: string) {
  const membership = await requireMember(userId, groupId);
  const session = await prisma.session.findFirst({ where: { id: sessionId, groupId } });
  if (!session) throw notFound("Session not found");
  const allowed = membership.role === "ADMIN" || (membership.role === "ORGANISER" && session.createdById === userId);
  if (!allowed) throw forbidden("Only an admin or the organiser who created this game day can change it");
  return { membership, session };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

export function randomGroupCode(length = 7) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export async function uniqueGroupCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomGroupCode();
    const exists = await prisma.group.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique group code");
}
