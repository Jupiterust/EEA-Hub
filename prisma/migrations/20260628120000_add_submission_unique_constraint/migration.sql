-- This migration was applied via db push
-- AlterTable: Add unique constraint on Submission(studentId, assignmentId)
-- and remove old index
DROP INDEX IF EXISTS "Submission_assignmentId_studentId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "Submission_studentId_assignmentId_key" ON "Submission"("studentId", "assignmentId");
