-- AlterEnum
ALTER TYPE "MembershipRole" ADD VALUE 'ORGANISER';

-- AlterTable
ALTER TABLE "SessionResult" ADD COLUMN     "chipsBought" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "chipsSold" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ChipTransfer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChipTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChipTransfer_sessionId_idx" ON "ChipTransfer"("sessionId");

-- AddForeignKey
ALTER TABLE "ChipTransfer" ADD CONSTRAINT "ChipTransfer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipTransfer" ADD CONSTRAINT "ChipTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipTransfer" ADD CONSTRAINT "ChipTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
