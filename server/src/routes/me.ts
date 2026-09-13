import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { wrap } from "../lib/errors.js";
import { signAvatarUpload } from "../lib/cloudinary.js";
import { dec, effective, summarize, timeline, type ResultPoint } from "../lib/stats.js";

export const meRouter = Router();

const publicUser = (u: { id: string; displayName: string; avatarUrl: string | null; email: string }) => ({
  id: u.id,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl,
  email: u.email,
});

meRouter.get(
  "/",
  wrap(async (req, res) => {
    res.json(publicUser(req.user));
  })
);

meRouter.patch(
  "/",
  wrap(async (req, res) => {
    const body = z
      .object({
        displayName: z.string().trim().min(1).max(40).optional(),
        avatarUrl: z.string().url().nullable().optional(),
      })
      .parse(req.body);
    const user = await prisma.user.update({ where: { id: req.user.id }, data: body });
    res.json(publicUser(user));
  })
);

/** Signed params for a direct-to-Cloudinary avatar upload. */
meRouter.post(
  "/avatar/sign",
  wrap(async (req, res) => {
    res.json(signAvatarUpload(req.user.id));
  })
);

/** All-time stats across every group plus solo games. */
meRouter.get(
  "/stats",
  wrap(async (req, res) => {
    const [results, solo] = await Promise.all([
      prisma.sessionResult.findMany({
        where: { userId: req.user.id },
        include: { session: { include: { group: { select: { id: true, name: true } } } } },
      }),
      prisma.soloGame.findMany({ where: { userId: req.user.id } }),
    ]);

    const groupPoints: ResultPoint[] = results.map((r) => {
      const e = effective(r);
      return {
        id: r.id,
        date: r.session.playedAt.toISOString(),
        label: r.session.title ?? r.session.location ?? "Session",
        groupId: r.session.group.id,
        groupName: r.session.group.name,
        sessionId: r.sessionId,
        buyIn: e.buyIn,
        cashOut: e.cashOut,
        net: e.net,
      };
    });

    const soloPoints: ResultPoint[] = solo.map((g) => ({
      id: g.id,
      date: g.playedAt.toISOString(),
      label: g.location ?? "Solo game",
      groupId: null,
      groupName: null,
      sessionId: null,
      buyIn: dec(g.buyIn) ?? 0,
      cashOut: dec(g.cashOut),
      net: (dec(g.cashOut) ?? 0) - (dec(g.buyIn) ?? 0),
    }));

    const all = [...groupPoints, ...soloPoints];

    // Per-group breakdown
    const byGroup = new Map<string, { groupId: string; groupName: string; points: ResultPoint[] }>();
    for (const p of groupPoints) {
      if (!p.groupId) continue;
      const entry = byGroup.get(p.groupId) ?? { groupId: p.groupId, groupName: p.groupName ?? "", points: [] };
      entry.points.push(p);
      byGroup.set(p.groupId, entry);
    }

    res.json({
      all: { summary: summarize(all), timeline: timeline(all) },
      groups: { summary: summarize(groupPoints), timeline: timeline(groupPoints) },
      solo: { summary: summarize(soloPoints), timeline: timeline(soloPoints) },
      byGroup: [...byGroup.values()].map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        summary: summarize(g.points),
      })),
    });
  })
);
