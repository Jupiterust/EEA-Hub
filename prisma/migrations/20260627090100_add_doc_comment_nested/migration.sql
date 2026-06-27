-- DropIndex
DROP INDEX "DocComment_docId_idx";

-- AlterTable
ALTER TABLE "DocComment" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "replyToId" TEXT;

-- CreateIndex
CREATE INDEX "DocComment_docId_parentId_idx" ON "DocComment"("docId", "parentId");

-- AddForeignKey
ALTER TABLE "DocComment" ADD CONSTRAINT "DocComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocComment" ADD CONSTRAINT "DocComment_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DocComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
