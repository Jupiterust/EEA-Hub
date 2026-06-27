-- AlterTable
ALTER TABLE "ForumReply" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "replyToId" TEXT;

-- CreateIndex
CREATE INDEX "ForumReply_postId_parentId_idx" ON "ForumReply"("postId", "parentId");

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ForumReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ForumReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
