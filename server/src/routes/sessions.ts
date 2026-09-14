import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, forbidden, notFound, wrap } from "../lib/errors.js";
import { requireMember, requireOrganiser, requireSessionManager } from "../lib/access.js";
import { dec, effective, round } from "../lib/stats.js";
import { highlightsRouter } from "./highlights.js";

/** Mounted at /groups/:groupId/sessions */
export const sessionsRouter = Router({ mergeParams: true });

sessionsRouter.use("/:sessionId/highlights", highlightsRouter);

const userSelect = { id: true, displayName: true, avatarUrl: true } as const;

const sessionInclude = {
  results: { include: { user: { select: userSelect } }, orderBy: { createdAt: "asc" } },
  transfers: {
    include: { from: { select: userSelect }, to: { select: userSelect } },
    orderBy: { createdAt: "asc" },
  },
  createdBy: { select: userSelect },
} as const;

type PublicUser = { id: string; displayName: string; avatarUrl: string | null };

type SessionRow = {
  id: string;
  groupId: string;
  title: string | null;
  location: string | null;
  notes: string | null;
  playedAt: Date;
  createdAt: Date;
  createdById: string;
  createdBy: PublicUser;
  results: Array<{
    id: string;
    userId: string;
    buyIn: unknown;
    cashOut: unknown;
    chipsBought: unknown;
    chipsSold: unknown;
    updatedAt: Date;
    user: PublicUser;
  }>;
  transfers: Array<{
    id: string;
    amount: unknown;
    createdById: string;
    createdAt: Date;
    from: PublicUser;
    to: PublicUser;
  }>;
};

function serialize(s: SessionRow) {
  const results = s.results.map((r) => {
    const e = effective(r);
    return {
      id: r.id,
      user: r.user,
      // Effective figures (what the player is actually up/down)
      buyIn: e.buyIn,
      cashOut: e.cashOut,
      net: e.net,
      submitted: e.submitted,
      // Bank figures + chip purchases, for the form and the breakdown
      bankBuyIn: e.bankBuyIn,
      bankCashOut: e.bankCashOut,
      chipsBought: e.chipsBought,
      chipsSold: e.chipsSold,
      updatedAt: r.updatedAt,
    };
  });
  const submitted = results.filter((r) => r.submitted);
  // Pot = chips bought from the bank. Player-to-player purchases don't add chips to the table.
  const pot = round(results.reduce((a, r) => a + r.bankBuyIn, 0));
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
    transfers: s.transfers.map((t) => ({
      id: t.id,
      amount: dec(t.amount as never) ?? 0,
      from: t.from,
      to: t.to,
      createdById: t.createdById,
      createdAt: t.createdAt,
    })),
    playerCount: results.length,
    submittedCount: submitted.length,
    pot,
    totalBuyIn,
    totalCashOut,
    // Non-zero means the table doesn't balance (someone typed a wrong number).
    discrepancy: submitted.length === results.length && results.length > 0 ? round(totalCashOut - totalBuyIn) : null,
    topWinner: ranked[0] ?? null,
    topLoser: ranked.length > 1 ? ranked[ranked.length - 1] : null,
  };
}

async function loadSession(sessionId: string) {
  return prisma.session.findUniqueOrThrow({ where: { id: sessionId }, include: sessionInclude });
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
    await requireOrganiser(req.user.id, groupId);
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
    await requireSessionManager(req.user.id, groupId, sessionId);
    const body = sessionBody.partial().parse(req.body);
    const session = await prisma.session.update({ where: { id: sessionId }, data: body, include: sessionInclude });
    res.json(serialize(session));
  })
);

sessionsRouter.delete(
  "/:sessionId",
  wrap(async (req, res) => {
    const { groupId, sessionId } = req.params as { groupId: string; sessionId: string };
    await requireSessionManager(req.user.id, groupId, sessionId);
    await prisma.session.delete({ where: { id: sessionId } });
    res.status(204).end();
  })
);

/** Seat a player at the session (admin, or the organiser who created it). */
sessionsRouter.post(
  "/:sessionId/players",
  wrap(async (req, res) => {
    const { groupId, sessionId } = req.params as { groupId: string; sessionId: string };
    await requireSessionManager(req.user.id, groupId, sessionId);
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    const member = await prisma.membership.findUnique({ where: { userId_groupId: { userId, groupId } } });
    if (!member || member.status !== "APPROVED") throw badRequest("User is not an approved member");
    await prisma.sessionResult.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      update: {},
      create: { sessionId, userId },
    });
    res.status(201).json(serialize(await loadSession(sessionId)));
  })
);

sessionsRouter.delete(
  "/:sessionId/players/:userId",
  wrap(async (req, res) => {
    const { groupId, sessionId, userId } = req.params as { groupId: string; sessionId: string; userId: string };
    await requireSessionManager(req.user.id, groupId, sessionId);
    const involved = await prisma.chipTransfer.count({ where: { sessionId, OR: [{ fromUserId: userId }, { toUserId: userId }] } });
    if (involved) throw badRequest("Remove this player's chip purchases first");
    await prisma.sessionResult.deleteMany({ where: { sessionId, userId } });
    res.json(serialize(await loadSession(sessionId)));
  })
);

const resultBody = z.object({
  buyIn: z.coerce.number().min(0).max(1_000_000),
  cashOut: z.coerce.number().min(0).max(1_000_000),
});

/**
 * Submit a result (bank buy-in + cash-out). Players may only edit their own row;
 * admins may fill in anyone's. Organisers cannot edit other players' figures.
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
    res.json(serialize(await loadSession(sessionId)));
  })
);

/* ---------------- Chip purchases between players ---------------- */

/** Recompute the denormalised chipsBought / chipsSold on every seat in the session. */
async function syncChipTotals(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], sessionId: string) {
  const [seats, transfers] = await Promise.all([
    tx.sessionResult.findMany({ where: { sessionId }, select: { id: true, userId: true } }),
    tx.chipTransfer.findMany({ where: { sessionId }, select: { fromUserId: true, toUserId: true, amount: true } }),
  ]);
  for (const seat of seats) {
    const bought = transfers.filter((t) => t.toUserId === seat.userId).reduce((a, t) => a + Number(t.amount), 0);
    const sold = transfers.filter((t) => t.fromUserId === seat.userId).reduce((a, t) => a + Number(t.amount), 0);
    await tx.sessionResult.update({ where: { id: seat.id }, data: { chipsBought: round(bought), chipsSold: round(sold) } });
  }
}

const transferBody = z.object({
  fromUserId: z.string(), // seller
  toUserId: z.string().optional(), // buyer — defaults to the caller
  amount: z.coerce.number().positive().max(1_000_000),
});

/**
 * Record "buyer bought `amount` of chips from seller". The buyer records it
 * (toUserId defaults to the caller). Admins may record one for any pair.
 */
sessionsRouter.post(
  "/:sessionId/transfers",
  wrap(async (req, res) => {
    const { groupId, sessionId } = req.params as { groupId: string; sessionId: string };
    const me = await requireMember(req.user.id, groupId);
    const body = transferBody.parse(req.body);
    const toUserId = body.toUserId ?? req.user.id;
    if (toUserId !== req.user.id && me.role !== "ADMIN") throw forbidden("You can only record chips you bought yourself");
    if (body.fromUserId === toUserId) throw badRequest("Buyer and seller must be different players");

    const session = await prisma.session.findFirst({ where: { id: sessionId, groupId } });
    if (!session) throw notFound("Session not found");
    const seated = await prisma.sessionResult.findMany({
      where: { sessionId, userId: { in: [body.fromUserId, toUserId] } },
      select: { userId: true },
    });
    if (seated.length !== 2) throw badRequest("Both players must be seated at this game day");

    await prisma.$transaction(async (tx) => {
      await tx.chipTransfer.create({
        data: { sessionId, fromUserId: body.fromUserId, toUserId, amount: round(body.amount), createdById: req.user.id },
      });
      await syncChipTotals(tx, sessionId);
    });
    res.status(201).json(serialize(await loadSession(sessionId)));
  })
);

/** Buyer, seller, or an admin can remove a chip purchase. */
sessionsRouter.delete(
  "/:sessionId/transfers/:transferId",
  wrap(async (req, res) => {
    const { groupId, sessionId, transferId } = req.params as { groupId: string; sessionId: string; transferId: string };
    const me = await requireMember(req.user.id, groupId);
    const t = await prisma.chipTransfer.findFirst({ where: { id: transferId, sessionId, session: { groupId } } });
    if (!t) throw notFound("Chip purchase not found");
    const allowed = me.role === "ADMIN" || t.fromUserId === req.user.id || t.toUserId === req.user.id;
    if (!allowed) throw forbidden("Only the buyer, the seller or an admin can remove this");

    await prisma.$transaction(async (tx) => {
      await tx.chipTransfer.delete({ where: { id: t.id } });
      await syncChipTotals(tx, sessionId);
    });
    res.json(serialize(await loadSession(sessionId)));
  })
);
