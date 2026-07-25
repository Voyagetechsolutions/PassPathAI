-- Move identity credentials into the Neon-backed users table.
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
DROP INDEX IF EXISTS "users_firebase_uid_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "firebase_uid";
