import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, forbidden, notFound, wrap } from "../lib/errors.js";
import { requireAdmin, requireMember, uniqueGroupCode } from "../lib/access.js";
import { dec, summarize, timeline, type ResultPoint } from "../lib/stats.js";

export const groupsRouter = Router();

const memberSelect = {
  id: true,
  role: true,
  status: true,
  createdAt: true,
  user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
} as const;

/** Groups I belong to (approved) or have requested to join (pending). */
groupsRouter.get(
  "/",
  wrap(async (req, res) => {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id, status: { in: ["APPROVED", "PENDING"] } },
      include: {
        group: {
          include: {
            _count: { select: { memberships: { where: { status: "APPROVED" } }, sessions: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Pending-request counts for groups I admin (for badges in the UI)
    const adminGroupIds = memberships.filter((m) => m.role === "ADMIN" && m.status === "APPROVED").map((m) => m.groupId);
    const pendingCounts = adminGroupIds.length
      ? await prisma.membership.groupBy({
          by: ["groupId"],
          where: { groupId: { in: adminGroupIds }, status: "PENDING" },
          _count: { _all: true },
        })
      : [];
    const pendingMap = new Map(pendingCounts.map((p) => [p.groupId, p._count._all]));

    res.json(
      memberships.map((m) => ({
        id: m.group.id,
        name: m.group.name,
        description: m.group.description,
        currency: m.group.currency,
        code: m.role === "ADMIN" ? m.group.code : undefined,
        role: m.role,
        status: m.status,
        memberCount: m.group._count.memberships,
        sessionCount: m.group._count.sessions,
        pendingRequests: pendingMap.get(m.group.id) ?? 0,
      }))
    );
  })
);

groupsRouter.post(
  "/",
  wrap(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(50),
        description: z.string().trim().max(200).optional(),
        currency: z.string().trim().min(1).max(4).default("€"),
      })
      .parse(req.body);

    const group = await prisma.group.create({
      data: {
        ...body,
        code: await uniqueGroupCode(),
        createdById: req.user.id,
        memberships: { create: { userId: req.user.id, role: "ADMIN", status: "APPROVED" } },
      },
    });
    res.status(201).json(group);
  })
);

/** Join with a code (or the code parsed from an invite link). Creates a PENDING request. */
groupsRouter.post(
  "/join",
  wrap(async (req, res) => {
    const { code } = z.object({ code: z.string().trim().toUpperCase().min(4).max(12) }).parse(req.body);
    const group = await prisma.group.findUnique({ where: { code } });
    if (!group) throw notFound("No group with that code");

    const existing = await prisma.membership.findUnique({
      where: { userId_groupId: { userId: req.user.id, groupId: group.id } },
    });
    if (existing?.status === "APPROVED") throw badRequest("You are already a member of this group");

    const membership = existing
      ? await prisma.membership.update({ where: { id: existing.id }, data: { status: "PENDING" } })
      : await prisma.membership.create({ data: { userId: req.user.id, groupId: group.id } });

    res.status(201).json({ groupId: group.id, groupName: group.name, status: membership.status });
  })
);

/** Public-ish preview of a group by code so the join page can show its name. */
groupsRouter.get(
  "/preview/:code",
  wrap(async (req, res) => {
    const group = await prisma.group.findUnique({
      where: { code: req.params.code.toUpperCase() },
      select: { id: true, name: true, description: true, _count: { select: { memberships: { where: { status: "APPROVED" } } } } },
    });
    if (!group) throw notFound("No group with that code");
    res.json({ id: group.id, name: group.name, description: group.description, memberCount: group._count.memberships });
  })
);

groupsRouter.get(
  "/:groupId",
  wrap(async (req, res) => {
    const { groupId } = req.params;
    const me = await requireMember(req.user.id, groupId);
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          where: me.role === "ADMIN" ? { status: { in: ["APPROVED", "PENDING"] } } : { status: "APPROVED" },
          select: memberSelect,
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!group) throw notFound("Group not found");

    res.json({
      id: group.id,
      name: group.name,
      description: group.description,
      currency: group.currency,
      code: me.role === "ADMIN" ? group.code : undefined,
      createdAt: group.createdAt,
      myRole: me.role,
      members: group.memberships.filter((m) => m.status === "APPROVED"),
      pending: group.memberships.filter((m) => m.status === "PENDING"),
    });
  })
);

groupsRouter.patch(
  "/:groupId",
  wrap(async (req, res) => {
    await requireAdmin(req.user.id, req.params.groupId);
    const body = z
      .object({
        name: z.string().trim().min(2).max(50).optional(),
        description: z.string().trim().max(200).nullable().optional(),
        currency: z.string().trim().min(1).max(4).optional(),
      })
      .parse(req.body);
    const group = await prisma.group.update({ where: { id: req.params.groupId }, data: body });
    res.json(group);
  })
);

groupsRouter.post(
  "/:groupId/regenerate-code",
  wrap(async (req, res) => {
    await requireAdmin(req.user.id, req.params.groupId);
    const group = await prisma.group.update({
      where: { id: req.params.groupId },
      data: { code: await uniqueGroupCode() },
    });
    res.json({ code: group.code });
  })
);

groupsRouter.post(
  "/:groupId/members/:membershipId/approve",
  wrap(async (req, res) => {
    await requireAdmin(req.user.id, req.params.groupId);
    const m = await prisma.membership.findFirst({ where: { id: req.params.membershipId, groupId: req.params.groupId } });
    if (!m) throw notFound("Request not found");
    const updated = await prisma.membership.update({ where: { id: m.id }, data: { status: "APPROVED" }, select: memberSelect });
    res.json(updated);
  })
);

groupsRouter.post(
  "/:groupId/members/:membershipId/reject",
  wrap(async (req, res) => {
    await requireAdmin(req.user.id, req.params.groupId);
    const m = await prisma.membership.findFirst({ where: { id: req.params.membershipId, groupId: req.params.groupId } });
    if (!m) throw notFound("Request not found");
    await prisma.membership.update({ where: { id: m.id }, data: { status: "REJECTED" } });
    res.status(204).end();
  })
);

groupsRouter.patch(
  "/:groupId/members/:membershipId",
  wrap(async (req, res) => {
    await requireAdmin(req.user.id, req.params.groupId);
    const { role } = z.object({ role: z.enum(["ADMIN", "MEMBER"]) }).parse(req.body);
    const m = await prisma.membership.findFirst({ where: { id: req.params.membershipId, groupId: req.params.groupId } });
    if (!m) throw notFound("Member not found");
    if (role === "MEMBER") {
      const admins = await prisma.membership.count({ where: { groupId: req.params.groupId, role: "ADMIN", status: "APPROVED" } });
      if (admins <= 1 && m.role === "ADMIN") throw badRequest("A group needs at least one admin");
    }
    const updated = await prisma.membership.update({ where: { id: m.id }, data: { role }, select: memberSelect });
    res.json(updated);
  })
);

/** Remove a member (admin) or leave the group (self). */
groupsRouter.delete(
  "/:groupId/members/:membershipId",
  wrap(async (req, res) => {
    const me = await requireMember(req.user.id, req.params.groupId);
    const m = await prisma.membership.findFirst({ where: { id: req.params.membershipId, groupId: req.params.groupId } });
    if (!m) throw notFound("Member not found");
    const isSelf = m.userId === req.user.id;
    if (!isSelf && me.role !== "ADMIN") throw forbidden("Admin only");
    if (m.role === "ADMIN") {
      const admins = await prisma.membership.count({ where: { groupId: req.params.groupId, role: "ADMIN", status: "APPROVED" } });
      if (admins <= 1) throw badRequest("Promote another admin before leaving");
    }
    await prisma.membership.delete({ where: { id: m.id } });
    res.status(204).end();
  })
);

/** Leaderboard: every approved member's summary within this group. */
groupsRouter.get(
  "/:groupId/leaderboard",
  wrap(async (req, res) => {
    const { groupId } = req.params;
    await requireMember(req.user.id, groupId);
    const members = await prisma.membership.findMany({
      where: { groupId, status: "APPROVED" },
      select: memberSelect,
    });
    const results = await prisma.sessionResult.findMany({
      where: { session: { groupId } },
      include: { session: { select: { playedAt: true, title: true, location: true } } },
    });
    const byUser = new Map<string, ResultPoint[]>();
    for (const r of results) {
      const list = byUser.get(r.userId) ?? [];
      list.push(toPoint(r, groupId));
      byUser.set(r.userId, list);
    }
    const rows = members.map((m) => ({
      user: m.user,
      role: m.role,
      summary: summarize(byUser.get(m.user.id) ?? []),
    }));
    rows.sort((a, b) => b.summary.net - a.summary.net);
    res.json(rows);
  })
);

/** A single player's stats inside this group (profile page). */
groupsRouter.get(
  "/:groupId/players/:userId/stats",
  wrap(async (req, res) => {
    const { groupId, userId } = req.params;
    await requireMember(req.user.id, groupId);
    const target = await prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
      select: memberSelect,
    });
    if (!target || target.status !== "APPROVED") throw notFound("Player not found in this group");
    const results = await prisma.sessionResult.findMany({
      where: { userId, session: { groupId } },
      include: { session: { select: { playedAt: true, title: true, location: true } } },
    });
    const points = results.map((r) => toPoint(r, groupId));
    res.json({ user: target.user, role: target.role, summary: summarize(points), timeline: timeline(points) });
  })
);

function toPoint(
  r: { id: string; sessionId: string; buyIn: unknown; cashOut: unknown; session: { playedAt: Date; title: string | null; location: string | null } },
  groupId: string
): ResultPoint {
  const buyIn = dec(r.buyIn as never) ?? 0;
  const cashOut = dec(r.cashOut as never);
  return {
    id: r.id,
    date: r.session.playedAt.toISOString(),
    label: r.session.title ?? r.session.location ?? "Session",
    groupId,
    groupName: null,
    sessionId: r.sessionId,
    buyIn,
    cashOut,
    net: cashOut == null ? null : cashOut - buyIn,
  };
}
