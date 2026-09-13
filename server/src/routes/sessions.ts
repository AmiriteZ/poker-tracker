import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, forbidden, notFound, wrap } from "../lib/errors.js";
import { requireAdmin, requireMember } from "../lib/access.js";
import { dec, round } from "../lib/stats.js";

/** Mounted at /groups/:groupId/sessions */
export const sessionsRouter = Router({ mergeParams: true });

const userSelect = { id: true, displayName: true, avatarUrl: true } as const;

const sessionInclude = {
  results: { include: { user: { select: userSelect } }, orderBy: { createdAt: "asc" } },
  createdBy: { select: userSelect },
} as const;

type SessionRow = {
  id: string;
  groupId: string;
  title: string | null;
  location: string | null;
  notes: string | null;
  playedAt: Date;
  createdAt: Date;
  createdBy: { id: string; displayName: string; avatarUrl: string | null };
  results: Array<{
    id: string;
    userId: string;
    buyIn: unknown;
    cashOut: unknown;
    updatedAt: Date;
    user: { id: string; displayName: string; avatarUrl: string | null };
  }>;
};

function serialize(s: SessionRow) {
  const results = s.results.map((r) => {
    const buyIn = dec(r.buyIn as never) ?? 0;
    const cashOut = dec(r.cashOut as never);
    return {
      id: r.id,
      user: r.user,
      buyIn,
      cashOut,
      net: cashOut == null ? null : round(cashOut - buyIn),
      submitted: cashOut != null,
      updatedAt: r.updatedAt,
    };
  });
  const submitted = results.filter((r) => r.submitted);
  const totalBuyIn = round(results.reduce((a, r) => a + r.buyIn, 0));
  const totalCashOut = round(submitted.reduce((a, r) => a + (r.cashOut ?? 0), 0));
  const ranked = [...submitted].sort((a, b) => (b.net ?? 0) - (a.net ?? 0));
  return {
    id: s.id,
    groupId: s.groupId,
    title: s.title,
    location: s.location,
    notes: s.notes,
    playedAt: s.playedAt,
    createdAt: s.createdAt,
    createdBy: s.createdBy,
    results,
    playerCount: results.length,
    submittedCount: submitted.length,
    totalBuyIn,
    totalCashOut,
    // Non-zero means the table doesn't balance (someone typed a wrong number).
    discrepancy: submitted.length === results.length ? round(totalCashOut - totalBuyIn) : null,
    topWinner: ranked[0] ?? null,
    topLoser: ranked.length > 1 ? ranked[ranked.length - 1] : null,
  };
}

sessionsRouter.get(
  "/",
  wrap(async (req, res) => {
    const { groupId } = req.params as { groupId: string };
    await requireMember(req.user.id, groupId);
    const sessions = await prisma.session.findMany({
      where: { groupId },
      include: sessionInclude,
      orderBy: { playedAt: "desc" },
    });
    res.json(sessions.map(serialize));
  })
);

const sessionBody = z.object({
  title: z.string().trim().max(60).nullable().optional(),
  location: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  playedAt: z.coerce.date(),
});

sessionsRouter.post(
  "/",
  wrap(async (req, res) => {
    const { groupId } = req.params as { groupId: string };
    await requireAdmin(req.user.id, groupId);
    const body = sessionBody.extend({ playerIds: z.array(z.string()).default([]) }).parse(req.body);

    // Only approved members may be seated.
    const approved = await prisma.membership.findMany({
      where: { groupId, status: "APPROVED", userId: { in: body.playerIds } },
      select: { userId: true },
    });
    const validIds = new Set(approved.map((m) => m.userId));
    const bad = body.playerIds.filter((id) => !validIds.has(id));
    if (bad.length) throw badRequest("Some players are not approved members of this group");

    const session = await prisma.session.create({
      data: {
        groupId,
        title: body.title ?? null,
        location: body.location ?? null,
        notes: body.notes ?? null,
        playedAt: body.playedAt,
        createdById: req.user.id,
        results: { create: body.playerIds.map((userId) => ({ userId })) },
      },
      include: sessionInclude,
    });
    res.status(201).json(serialize(session));
  })
);

sessionsRouter.get(
  "/:sessionId",
  wrap(async (req, res) => {
    const { groupId, sessionId } = req.params as { groupId: string; sessionId: string };
    await requireMember(req.user.id, groupId);
    const session = await prisma.session.findFirst({ where: { id: sessionId, groupId }, include: sessionInclude });
    if (!session) throw notFound("Session not found");
    res.json(serialize(session));
  })
);

sessionsRouter.patch(
  "/:sessionId",
  wrap(async (req, res) => {
    const { groupId, sessionId } = req.params as { groupId: string; sessionId: string };
    await requireAdmin(req.user.id, groupId);
    const body = sessionBody.partial().parse(req.body);
    const exists = await prisma.session.findFirst({ where: { id: sessionId, groupId } });
    if (!exists) throw notFound("Session not found");
    const session = await prisma.session.update({ where: { id: sessionId }, data: body, include: sessionInclude });
    res.json(serialize(session));
  })
);

sessionsRouter.delete(
  "/:sessionId",
  wrap(async (req, res) => {
    const { groupId, sessionId } = req.params as { groupId: string; sessionId: string };
    await requireAdmin(req.user.id, groupId);
    const exists = await prisma.session.findFirst({ where: { id: sessionId, groupId } });
    if (!exists) throw notFound("Session not found");
    await prisma.session.delete({ where: { id: sessionId } });
    res.status(204).end();
  })
);

/** Admin seats a player at the session. */
sessionsRouter.post(
  "/:sessionId/players",
  wrap(async (req, res) => {
    const { groupId, sessionId } = req.params as { groupId: string; sessionId: string };
    await requireAdmin(req.user.id, groupId);
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    const session = await prisma.session.findFirst({ where: { id: sessionId, groupId } });
    if (!session) throw notFound("Session not found");
    const member = await prisma.membership.findUnique({ where: { userId_groupId: { userId, groupId } } });
    if (!member || member.status !== "APPROVED") throw badRequest("User is not an approved member");
    await prisma.sessionResult.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      update: {},
      create: { sessionId, userId },
    });
    const updated = await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, include: sessionInclude });
    res.status(201).json(serialize(updated));
  })
);

sessionsRouter.delete(
  "/:sessionId/players/:userId",
  wrap(async (req, res) => {
    const { groupId, sessionId, userId } = req.params as { groupId: string; sessionId: string; userId: string };
    await requireAdmin(req.user.id, groupId);
    const session = await prisma.session.findFirst({ where: { id: sessionId, groupId } });
    if (!session) throw notFound("Session not found");
    await prisma.sessionResult.deleteMany({ where: { sessionId, userId } });
    const updated = await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, include: sessionInclude });
    res.json(serialize(updated));
  })
);

const resultBody = z.object({
  buyIn: z.coerce.number().min(0).max(1_000_000),
  cashOut: z.coerce.number().min(0).max(1_000_000),
});

/**
 * Submit a result. Players may only edit their own row; admins may fill in
 * anyone's (handy when a friend forgets).
 */
sessionsRouter.put(
  "/:sessionId/results/:userId",
  wrap(async (req, res) => {
    const { groupId, sessionId } = req.params as { groupId: string; sessionId: string };
    const targetUserId = req.params.userId === "me" ? req.user.id : req.params.userId;
    const me = await requireMember(req.user.id, groupId);
    if (targetUserId !== req.user.id && me.role !== "ADMIN") throw forbidden("You can only submit your own result");

    const body = resultBody.parse(req.body);
    const session = await prisma.session.findFirst({ where: { id: sessionId, groupId } });
    if (!session) throw notFound("Session not found");
    const seat = await prisma.sessionResult.findUnique({ where: { sessionId_userId: { sessionId, userId: targetUserId } } });
    if (!seat) throw forbidden("You were not added to this session — ask an admin to seat you");

    await prisma.sessionResult.update({ where: { id: seat.id }, data: body });
    const updated = await prisma.session.findUniqueOrThrow({ where: { id: sessionId }, include: sessionInclude });
    res.json(serialize(updated));
  })
);
