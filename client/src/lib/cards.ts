/**
 * Playing-card assets and helpers for the Highlights feature.
 * Source images live in src/assets/images/cards/ as `${suit}-${rank}.png` (500x700,
 * already rendered with rounded corners baked into the alpha channel) plus a single
 * `card-back.png`. Loaded via import.meta.glob so adding/renaming a card file doesn't
 * need code changes — Vite resolves each to a hashed, separately-fetched URL (nothing
 * is inlined into the JS bundle).
 */

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export const SUITS = ["club", "diamond", "heart", "spade"] as const;
export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

const cardImages = import.meta.glob("../assets/images/cards/*.png", { eager: true, import: "default" }) as Record<string, string>;

function findAsset(filename: string) {
  const match = Object.entries(cardImages).find(([path]) => path.endsWith(`/${filename}`));
  if (!match) throw new Error(`Missing card asset: ${filename}`);
  return match[1];
}

export const cardBackSrc = findAsset("card-back.png");

export function cardImageSrc(card: Card) {
  return findAsset(`${card.suit}-${card.rank}.png`);
}

export const cardKey = (c: Card) => `${c.suit}-${c.rank}`;
export const cardsEqual = (a?: Card | null, b?: Card | null) => !!a && !!b && a.rank === b.rank && a.suit === b.suit;

export const SUIT_LABEL: Record<Suit, string> = { club: "Clubs", diamond: "Diamonds", heart: "Hearts", spade: "Spades" };
export const SUIT_SYMBOL: Record<Suit, string> = { club: "♣", diamond: "♦", heart: "♥", spade: "♠" };
/** Only used to color the tiny suit glyph next to a picker column — the card art itself is untouched. */
export const isRedSuit = (suit: Suit) => suit === "heart" || suit === "diamond";

export function cardLabel(c: Card) {
  return `${c.rank} of ${SUIT_LABEL[c.suit]}`;
}

export type RevealStage = "START" | "FLOP" | "TURN" | "RIVER";

export const REVEAL_STAGE_LABEL: Record<RevealStage, string> = {
  START: "At the start",
  FLOP: "On the flop",
  TURN: "On the turn",
  RIVER: "On the river",
};

/** Community slot captions — positions 0-2 flop, 3 turn, 4 river (fixed, not user-orderable). */
export const COMMUNITY_LABELS = ["Flop", "Flop", "Flop", "Turn", "River"] as const;
