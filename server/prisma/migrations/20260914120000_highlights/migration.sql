-- CreateEnum
CREATE TYPE "RevealStage" AS ENUM ('START', 'FLOP', 'TURN', 'RIVER');

-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "title" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HighlightCard" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rank" TEXT NOT NULL,
    "suit" TEXT NOT NULL,

    CONSTRAINT "HighlightCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HighlightPlayer" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revealedAt" "RevealStage" NOT NULL DEFAULT 'START',
    "holeRank1" TEXT,
    "holeSuit1" TEXT,
    "holeRank2" TEXT,
    "holeSuit2" TEXT,
    "seatOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HighlightPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Highlight_sessionId_idx" ON "Highlight"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "HighlightCard_highlightId_position_key" ON "HighlightCard"("highlightId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "HighlightPlayer_highlightId_userId_key" ON "HighlightPlayer"("highlightId", "userId");

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HighlightCard" ADD CONSTRAINT "HighlightCard_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "Highlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HighlightPlayer" ADD CONSTRAINT "HighlightPlayer_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "Highlight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HighlightPlayer" ADD CONSTRAINT "HighlightPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
