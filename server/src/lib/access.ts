import { prisma } from "./prisma.js";
import { forbidden, notFound } from "./errors.js";

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
