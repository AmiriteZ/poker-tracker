export interface PublicUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email?: string;
}

export interface Summary {
  games: number;
  submitted: number;
  totalBuyIn: number;
  totalCashOut: number;
  net: number;
  wins: number;
  losses: number;
  breakEven: number;
  biggestWin: number;
  biggestLoss: number;
  avgNet: number;
}

export interface TimelinePoint {
  id: string;
  date: string;
  label: string;
  groupId: string | null;
  groupName: string | null;
  sessionId: string | null;
  buyIn: number;
  cashOut: number | null;
  net: number | null;
  cumulative: number;
}

export interface StatsBlock {
  summary: Summary;
  timeline: TimelinePoint[];
}

export interface MyStats {
  all: StatsBlock;
  groups: StatsBlock;
  solo: StatsBlock;
  byGroup: { groupId: string; groupName: string; summary: Summary }[];
}

export type Role = "ADMIN" | "ORGANISER" | "MEMBER";
export type MembershipStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface GroupListItem {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  code?: string;
  role: Role;
  status: MembershipStatus;
  memberCount: number;
  sessionCount: number;
  pendingRequests: number;
}

export interface Member {
  id: string; // membership id
  role: Role;
  status: MembershipStatus;
  createdAt: string;
  user: PublicUser;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  code?: string;
  createdAt: string;
  myRole: Role;
  members: Member[];
  pending: Member[];
}

export interface SessionResultRow {
  id: string;
  user: PublicUser;
  /** Effective figures: bank + chips bought/sold between players */
  buyIn: number;
  cashOut: number | null;
  net: number | null;
  submitted: boolean;
  /** Bank figures (what the player typed) and the chip-purchase adjustments */
  bankBuyIn: number;
  bankCashOut: number | null;
  chipsBought: number;
  chipsSold: number;
  updatedAt: string;
}

export interface ChipTransfer {
  id: string;
  amount: number;
  from: PublicUser; // seller
  to: PublicUser; // buyer
  createdById: string;
  createdAt: string;
}

export interface Session {
  id: string;
  groupId: string;
  title: string | null;
  location: string | null;
  notes: string | null;
  playedAt: string;
  createdAt: string;
  createdBy: PublicUser;
  results: SessionResultRow[];
  transfers: ChipTransfer[];
  playerCount: number;
  submittedCount: number;
  /** Chips bought from the bank — unchanged by player-to-player purchases */
  pot: number;
  totalBuyIn: number;
  totalCashOut: number;
  discrepancy: number | null;
  topWinner: SessionResultRow | null;
  topLoser: SessionResultRow | null;
}

export interface LeaderboardRow {
  user: PublicUser;
  role: Role;
  summary: Summary;
}

export interface PlayerStats {
  user: PublicUser;
  role: Role;
  summary: Summary;
  timeline: TimelinePoint[];
}

export interface SoloGame {
  id: string;
  playedAt: string;
  location: string | null;
  notes: string | null;
  buyIn: number;
  cashOut: number;
  net: number;
}

export interface SoloResponse extends StatsBlock {
  games: SoloGame[];
}

export type RevealStage = "START" | "FLOP" | "TURN" | "RIVER";

export interface HighlightPlayerRow {
  id: string;
  user: PublicUser;
  revealedAt: RevealStage;
  hole1: { rank: string; suit: string } | null;
  hole2: { rank: string; suit: string } | null;
}

export interface Highlight {
  id: string;
  sessionId: string;
  title: string | null;
  createdBy: PublicUser;
  createdAt: string;
  /** Always exactly 5, positions 0-2 flop, 3 turn, 4 river. */
  cards: { rank: string; suit: string }[];
  players: HighlightPlayerRow[];
}
