-- Add commitId column to Deployment table to track git commit hash
ALTER TABLE "Deployment" ADD COLUMN "commitId" TEXT;
