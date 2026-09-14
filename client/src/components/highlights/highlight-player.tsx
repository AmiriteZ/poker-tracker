import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward, Trophy } from "lucide-react";
import type { Highlight, RevealStage } from "@/lib/types";
import { COMMUNITY_LABELS, type Card } from "@/lib/cards";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { TableFrame } from "./table-frame";
import { PlayingCard } from "./playing-card";

/**
 * One beat of the animation: flip a group of community cards, or reveal a group of
 * players' hole cards. Built once per highlight from its players' `revealedAt` choices —
 * a reveal beat is only included if someone actually asked to be shown at that stage, so a
 * highlight with no START-revealed players just goes straight to the flop.
 */
type Beat = { kind: "community"; indices: number[] } | { kind: "players"; stage: RevealStage; userIds: string[] };

function buildBeats(highlight: Highlight): Beat[] {
  const beats: Beat[] = [];
  const playersAt = (stage: RevealStage) => highlight.players.filter((p) => p.revealedAt === stage && (p.hole1 || p.hole2)).map((p) => p.user.id);

  const start = playersAt("START");
  if (start.length) beats.push({ kind: "players", stage: "START", userIds: start });

  beats.push({ kind: "community", indices: [0, 1, 2] }); // flop — all three flip together
  const flop = playersAt("FLOP");
  if (flop.length) beats.push({ kind: "players", stage: "FLOP", userIds: flop });

  beats.push({ kind: "community", indices: [3] }); // turn
  const turn = playersAt("TURN");
  if (turn.length) beats.push({ kind: "players", stage: "TURN", userIds: turn });

  beats.push({ kind: "community", indices: [4] }); // river
  const river = playersAt("RIVER");
  if (river.length) beats.push({ kind: "players", stage: "RIVER", userIds: river });

  return beats;
}

const BEAT_PAUSE_MS = 900;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Plays a highlight back: cards start face-down on the felt and flip up in order — flop
 * (all three together), then turn, then river — with each player's hole cards flipping in
 * whenever the creator said they were revealed. `step` is "how many beats have completed";
 * -1 means nothing has happened yet. Playing auto-advances `step` on a timer; the JSX below
 * just renders whatever the current `step` implies is face-up, so scrubbing/skipping is free.
 */
export function HighlightPlayer({ highlight }: { highlight: Highlight }) {
  const beats = useMemo(() => buildBeats(highlight), [highlight]);
  const reducedMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const finished = step >= beats.length - 1;

  useEffect(() => {
    if (!playing || finished) return;
    timer.current = setTimeout(() => setStep((s) => s + 1), reducedMotion ? 150 : BEAT_PAUSE_MS);
    return () => clearTimeout(timer.current);
  }, [playing, finished, step, reducedMotion]);

  // Autoplay from mount.
  useEffect(() => {
    setStep(-1);
    setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight.id]);

  const faceUpCommunity = new Set(beats.slice(0, step + 1).filter((b) => b.kind === "community").flatMap((b) => (b as { indices: number[] }).indices));
  const faceUpPlayers = new Set(
    beats
      .slice(0, step + 1)
      .filter((b) => b.kind === "players")
      .flatMap((b) => (b as { userIds: string[] }).userIds)
  );

  const replay = () => {
    setStep(-1);
    setPlaying(true);
  };
  const skip = () => {
    setStep(beats.length - 1);
    setPlaying(false);
  };
  const togglePlay = () => (finished ? replay() : setPlaying((p) => !p));

  // Every player in the hand gets a row (a winner with no recorded hole cards still needs somewhere
  // to glow); rows without cards just show the name.
  const players = highlight.players;
  // The winner glow is the payoff of the replay, so it only appears once the last beat has landed —
  // never during Play, and immediately on Skip.
  const showWinners = finished;

  return (
    <div className="space-y-4">
      <TableFrame>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {highlight.cards.map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <PlayingCard card={c as Card} faceUp={faceUpCommunity.has(i)} animated widthClassName="w-14 sm:w-20" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">{COMMUNITY_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </TableFrame>

      {players.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => {
            const up = faceUpPlayers.has(p.user.id);
            const won = showWinners && p.isWinner;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border bg-card p-2.5 transition-[border-color,box-shadow] duration-700",
                  won ? "border-win shadow-[0_0_0_1px_hsl(var(--win)/0.6),0_0_22px_hsl(var(--win)/0.45)]" : up ? "border-primary/40" : ""
                )}
              >
                <UserAvatar name={p.user.displayName} src={p.user.avatarUrl} className="size-8 shrink-0" />
                <div className="min-w-0 flex-1 truncate text-sm font-medium">{p.user.displayName}</div>
                {won ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-win animate-fade-in">
                    <Trophy className="size-3.5" /> Winner
                  </span>
                ) : null}
                <div className="flex shrink-0 gap-1">
                  {[p.hole1, p.hole2].filter((c): c is Card => !!c).map((c, i) => (
                    <PlayingCard key={i} card={c} faceUp={up} animated widthClassName="w-9" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={replay}>
          <RotateCcw /> Replay
        </Button>
        <Button type="button" size="sm" onClick={togglePlay}>
          {playing && !finished ? <Pause /> : <Play />} {playing && !finished ? "Pause" : finished ? "Replay" : "Play"}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={finished} onClick={skip}>
          <SkipForward /> Skip
        </Button>
      </div>
    </div>
  );
}
