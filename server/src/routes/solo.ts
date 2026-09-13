import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { notFound, wrap } from "../lib/errors.js";
import { dec, round, summarize, timeline, type ResultPoint } from "../lib/stats.js";

export const soloRouter = Router();

const body = z.object({
  playedAt: z.coerce.date(),
  location: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  buyIn: z.coerce.number().min(0).max(1_000_000),
  cashOut: z.coerce.number().min(0).max(1_000_000),
});

type Row = { id: string; playedAt: Date; location: string | null; notes: string | null; buyIn: unknown; cashOut: unknown };

function serialize(g: Row) {
  const buyIn = dec(g.buyIn as never) ?? 0;
  const cashOut = dec(g.cashOut as never) ?? 0;
  return { id: g.id, playedAt: g.playedAt, location: g.location, notes: g.notes, buyIn, cashOut, net: round(cashOut - buyIn) };
}

soloRouter.get(
  "/",
  wrap(async (req, res) => {
    const games = await prisma.soloGame.findMany({ where: { userId: req.user.id }, orderBy: { playedAt: "desc" } });
    const rows = games.map(serialize);
    const points: ResultPoint[] = rows.map((r) => ({
      id: r.id,
      date: new Date(r.playedAt).toISOString(),
      label: r.location ?? "Solo game",
      groupId: null,
      groupName: null,
      sessionId: null,
      buyIn: r.buyIn,
      cashOut: r.cashOut,
      net: r.net,
    }));
    res.json({ games: rows, summary: summarize(points), timeline: timeline(points) });
  })
);

soloRouter.post(
  "/",
  wrap(async (req, res) => {
    const data = body.parse(req.body);
    const game = await prisma.soloGame.create({ data: { ...data, userId: req.user.id } });
    res.status(201).json(serialize(game));
  })
);

soloRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    const data = body.partial().parse(req.body);
    const existing = await prisma.soloGame.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) throw notFound("Game not found");
    const game = await prisma.soloGame.update({ where: { id: existing.id }, data });
    res.json(serialize(game));
  })
);

soloRouter.delete(
  "/:id",
  wrap(async (req, res) => {
    const existing = await prisma.soloGame.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!existing) throw notFound("Game not found");
    await prisma.soloGame.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);
