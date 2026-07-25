CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');
ALTER TABLE "student_profiles" ADD COLUMN "reward_points" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "friendships" (
  "id" TEXT NOT NULL, "requester_id" TEXT NOT NULL, "addressee_id" TEXT NOT NULL,
  "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "peer_messages" (
  "id" TEXT NOT NULL, "friendship_id" TEXT NOT NULL, "sender_id" TEXT NOT NULL,
  "content" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMP(3), CONSTRAINT "peer_messages_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "study_activities" (
  "id" TEXT NOT NULL, "student_id" TEXT NOT NULL, "study_date" DATE NOT NULL,
  "minutes" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "study_activities_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "friend_study_streaks" (
  "id" TEXT NOT NULL, "friendship_id" TEXT NOT NULL, "current_streak" INTEGER NOT NULL DEFAULT 0,
  "longest_streak" INTEGER NOT NULL DEFAULT 0, "last_shared_date" DATE,
  "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "friend_study_streaks_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "reward_definitions" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL,
  "icon" TEXT NOT NULL, "points" INTEGER NOT NULL, "threshold" INTEGER NOT NULL, "category" TEXT NOT NULL,
  CONSTRAINT "reward_definitions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "student_rewards" (
  "id" TEXT NOT NULL, "student_id" TEXT NOT NULL, "reward_id" TEXT NOT NULL,
  "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "student_rewards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "friendships_requester_id_addressee_id_key" ON "friendships"("requester_id", "addressee_id");
CREATE INDEX "friendships_addressee_id_status_idx" ON "friendships"("addressee_id", "status");
CREATE INDEX "peer_messages_friendship_id_created_at_idx" ON "peer_messages"("friendship_id", "created_at");
CREATE UNIQUE INDEX "study_activities_student_id_study_date_key" ON "study_activities"("student_id", "study_date");
CREATE INDEX "study_activities_study_date_idx" ON "study_activities"("study_date");
CREATE UNIQUE INDEX "friend_study_streaks_friendship_id_key" ON "friend_study_streaks"("friendship_id");
CREATE UNIQUE INDEX "reward_definitions_code_key" ON "reward_definitions"("code");
CREATE UNIQUE INDEX "student_rewards_student_id_reward_id_key" ON "student_rewards"("student_id", "reward_id");
CREATE INDEX "student_rewards_student_id_earned_at_idx" ON "student_rewards"("student_id", "earned_at");

ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE;
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE;
ALTER TABLE "peer_messages" ADD CONSTRAINT "peer_messages_friendship_id_fkey" FOREIGN KEY ("friendship_id") REFERENCES "friendships"("id") ON DELETE CASCADE;
ALTER TABLE "peer_messages" ADD CONSTRAINT "peer_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE;
ALTER TABLE "study_activities" ADD CONSTRAINT "study_activities_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE;
ALTER TABLE "friend_study_streaks" ADD CONSTRAINT "friend_study_streaks_friendship_id_fkey" FOREIGN KEY ("friendship_id") REFERENCES "friendships"("id") ON DELETE CASCADE;
ALTER TABLE "student_rewards" ADD CONSTRAINT "student_rewards_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE;
ALTER TABLE "student_rewards" ADD CONSTRAINT "student_rewards_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "reward_definitions"("id") ON DELETE CASCADE;

INSERT INTO "reward_definitions" ("id", "code", "title", "description", "icon", "points", "threshold", "category") VALUES
  ('reward-first-session', 'FIRST_SESSION', 'First Step', 'Complete your first study check-in.', '🌱', 50, 1, 'sessions'),
  ('reward-week-warrior', 'WEEK_WARRIOR', 'Week Warrior', 'Study for 7 days.', '🔥', 150, 7, 'sessions'),
  ('reward-study-buddy', 'STUDY_BUDDY', 'Study Buddy', 'Build a 3-day streak with a friend.', '🤝', 100, 3, 'friend_streak'),
  ('reward-streak-team', 'STREAK_TEAM', 'Streak Team', 'Build a 7-day streak with a friend.', '⚡', 250, 7, 'friend_streak');
