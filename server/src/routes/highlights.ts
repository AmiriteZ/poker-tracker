import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound, wrap } from "../lib/errors.js";
import { requireMember, requireSessionManager } from "../lib/access.js";

/** Mounted at /groups/:groupId/sessions/:sessionId/highlights */
export const highlightsRouter = Router({ mergeParams: true });

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
const SUITS = ["club", "diamond", "heart", "spade"] as const;
const REVEAL_STAGES = ["START", "FLOP", "TURN", "RIVER"] as const;

const cardSchema = z.object({ rank: z.enum(RANKS), suit: z.enum(SUITS) });

const playerSchema = z.object({
  userId: z.string(),
  revealedAt: z.enum(REVEAL_STAGES).default("START"),
  hole1: cardSchema.nullable().optional(),
  hole2: cardSchema.nullable().optional(),
});

// The 5 community slots are always flop(0-2)/turn(3)/river(4) — fixed positions, not free-form.
const highlightBody = z.object({
  title: z.string().trim().max(80).nullable().optional(),
  cards: z.array(cardSchema).length(5),
  players: z.array(playerSchema).max(10).default([]),
});

type Card = { rank: string; suit: string };
const cardKey = (c: Card) => `${c.suit}-${c.rank}`;

/** A real deck has 52 unique cards — catch a card reused between the board and any hole cards. */
function assertNoDuplicateCards(cards: Card[], players: { hole1?: Card | null; hole2?: Card | null }[]) {
  const seen = new Map<string, string>();
  const claim = (c: Card | null | undefined, where: string) => {
    if (!c) return;
    const key = cardKey(c);
    const prior = seen.get(key);
    if (prior) throw badRequest(`The ${c.rank} of ${c.suit}s is used twice (${prior} and ${where}) — every card can only appear once`);
    seen.set(key, where);
  };
  cards.forEach((c, i) => claim(c, i < 3 ? "the flop" : i === 3 ? "the turn" : "the river"));
  players.forEach((p, i) => {
    claim(p.hole1, `player ${i + 1}'s hand`);
    claim(p.hole2, `player ${i + 1}'s hand`);
  });
}

async function assertSeated(sessionId: string, userIds: string[]) {
  if (!userIds.length) return;
  const seated = await prisma.sessionResult.findMany({ where: { sessionId, userId: { in: userIds } }, select: { userId: true } });
  const ok = new Set(seated.map((s) => s.userId));
  const bad = userIds.filter((id) => !ok.has(id));
  if (bad.length) throw badRequest("Every player in a highlight must be seated at this game day");
}

const userSelect = { id: true, displayName: true, avatarUrl: true } as const;

const highlightInclude = {
  cards: { orderBy: { position: "asc" } },
  players: { include: { user: { select: userSelect } }, orderBy: { seatOrder: "asc" } },
  createdBy: { select: userSelect },
} as const;

type HighlightRow = Awaited<ReturnType<typeof loadOne>>;

function serialize(h: NonNullable<HighlightRow>) {
  return {
    id: h.id,
    sessionId: h.sessionId,
    title: h.title,
    createdBy: h.createdBy,
    createdAt: h.createdAt,
    cards: h.cards.map((c) => ({ rank: c.rank, suit: c.suit })),
    players: h.players.map((p) => ({
      id: p.id,
      user: p.user,
      revealedAt: p.revealedAt,
      hole1: p.holeRank1 && p.holeSuit1 ? { rank: p.holeRank1, suit: p.holeSuit1 } : null,
      hole2: p.holeRank2 && p.holeSuit2 ? { rank: p.holeRank2, suit: p.holeSuit2 } : null,
    })),
  };
}

function loadOne(highlightId: string) {
  return prisma.highlight.findUnique({ where: { id: highlightId }, include: highlightInclude });
}

highlightsRouter.get(
  "/",
  wrap(async (req, res) => {
    const { groupId, sessionId } = req.params as { groupId: string; sessionId: string };
    await requireMember(req.user.id, groupId);
    const session = await prisma.session.findFirst({ where: { id: sessionId, groupId }, select: { id: true } });
    if (!session) throw notFound("Session not found");
    const highlights = await prisma.highlight.findMany({ where: { sessionId }, include: highlightInclude, orderBy: { createdAt: "asc" } });
    res.json(highlights.map(serialize));
  })
);

highlightsRouter.post(
  "/",
  wrap(async (req, res) => {
    const { groupId, sessionId } = req.params as { groupId: string; sessionId: string };
    await requireSessionManager(req.user.id, groupId, sessionId);
    const body = highlightBody.parse(req.body);

    const userIds = body.players.map((p) => p.userId);
    if (new Set(userIds).size !== userIds.length) throw badRequest("A player can only appear once in a highlight");
    await assertSeated(sessionId, userIds);
    assertNoDuplicateCards(body.cards, body.players);

    const created = await prisma.highlight.create({
      data: {
        sessionId,
        title: body.title || null,
        createdById: req.user.id,
        cards: { create: body.cards.map((c, position) => ({ position, rank: c.rank, suit: c.suit })) },
        players: {
          create: body.players.map((p, seatOrder) => ({
            userId: p.userId,
            revealedAt: p.revealedAt,
            holeRank1: p.hole1?.rank ?? null,
            holeSuit1: p.hole1?.suit ?? null,
            holeRank2: p.hole2?.rank ?? null,
            holeSuit2: p.hole2?.suit ?? null,
            seatOrder,
          })),
        },
      },
    });
    res.status(201).json(serialize((await loadOne(created.id))!));
  })
);

/** Admins may edit any highlight on a session they can manage; organisers only their own sessions
 * (same rule as everything else on a game day — see requireSessionManager). */
async function requireHighlightManager(groupId: string, sessionId: string, highlightId: string, userId: string) {
  await requireSessionManager(userId, groupId, sessionId);
  const highlight = await prisma.highlight.findFirst({ where: { id: highlightId, sessionId } });
  if (!highlight) throw notFound("Highlight not found");
  return highlight;
}

highlightsRouter.patch(
  "/:highlightId",
  wrap(async (req, res) => {
    const { groupId, sessionId, highlightId } = req.params as { groupId: string; sessionId: string; highlightId: string };
    await requireHighlightManager(groupId, sessionId, highlightId, req.user.id);
    const body = highlightBody.parse(req.body);

    const userIds = body.players.map((p) => p.userId);
    if (new Set(userIds).size !== userIds.length) throw badRequest("A player can only appear once in a highlight");
    await assertSeated(sessionId, userIds);
    assertNoDuplicateCards(body.cards, body.players);

    // Nested collections (cards/players) are wholesale-replaced rather than diffed —
    // the editor always submits the highlight's full current state, so this stays simple and correct.
    await prisma.$transaction(async (tx) => {
      await tx.highlightCard.deleteMany({ where: { highlightId } });
      await tx.highlightPlayer.deleteMany({ where: { highlightId } });
      await tx.highlight.update({
        where: { id: highlightId },
        data: {
          title: body.title || null,
          cards: { create: body.cards.map((c, position) => ({ position, rank: c.rank, suit: c.suit })) },
          players: {
            create: body.players.map((p, seatOrder) => ({
              userId: p.userId,
              revealedAt: p.revealedAt,
              holeRank1: p.hole1?.rank ?? null,
              holeSuit1: p.hole1?.suit ?? null,
              holeRank2: p.hole2?.rank ?? null,
              holeSuit2: p.hole2?.suit ?? null,
              seatOrder,
            })),
          },
        },
      });
    });
    res.json(serialize((await loadOne(highlightId))!));
  })
);

highlightsRouter.delete(
  "/:highlightId",
  wrap(async (req, res) => {
    const { groupId, sessionId, highlightId } = req.params as { groupId: string; sessionId: string; highlightId: string };
    await requireHighlightManager(groupId, sessionId, highlightId, req.user.id);
    await prisma.highlight.delete({ where: { id: highlightId } });
    res.status(204).end();
  })
);
