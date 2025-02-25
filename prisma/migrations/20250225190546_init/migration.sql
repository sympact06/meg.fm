-- CreateTable
CREATE TABLE "spotify_tokens" (
    "discordId" TEXT NOT NULL PRIMARY KEY,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "listening_history" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discordId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "trackName" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "albumName" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "user_statistics" (
    "discordId" TEXT NOT NULL PRIMARY KEY,
    "total_tracks_played" INTEGER NOT NULL DEFAULT 0,
    "total_listening_time_ms" INTEGER NOT NULL DEFAULT 0,
    "last_checked" INTEGER NOT NULL DEFAULT 0,
    "favorite_artist" TEXT,
    "favorite_track" TEXT
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "discordId" TEXT NOT NULL,
    "achievement_id" TEXT NOT NULL,
    "unlocked_at" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("discordId", "achievement_id")
);

-- CreateTable
CREATE TABLE "friends" (
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" INTEGER NOT NULL,
    "updated_at" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "friendId")
);

-- CreateIndex
CREATE INDEX "listening_history_discordId_idx" ON "listening_history"("discordId");

-- CreateIndex
CREATE INDEX "listening_history_timestamp_idx" ON "listening_history"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "listening_history_discordId_trackId_timestamp_key" ON "listening_history"("discordId", "trackId", "timestamp");

-- CreateIndex
CREATE INDEX "user_achievements_discordId_idx" ON "user_achievements"("discordId");
