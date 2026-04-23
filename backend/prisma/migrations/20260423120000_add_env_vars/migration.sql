-- Add envVars column to Deployment table for storing environment variables as JSON
ALTER TABLE "Deployment" ADD COLUMN "envVars" TEXT;
