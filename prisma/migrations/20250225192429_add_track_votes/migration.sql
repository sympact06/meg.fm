-- CreateTable
CREATE TABLE "track_votes" (
    "trackId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "voted_at" INTEGER NOT NULL,

    PRIMARY KEY ("trackId", "discordId")
);
