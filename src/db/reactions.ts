import { prisma } from '../lib/prisma';

export async function recordVote(trackId: string, discordId: string, vote: string) {
  const now = Math.floor(Date.now() / 1000);

  await prisma.trackVote.upsert({
    where: {
      trackId_discordId: {
        trackId,
        discordId,
      },
    },
    update: {
      vote,
      votedAt: now,
    },
    create: {
      trackId,
      discordId,
      vote,
      votedAt: now,
    },
  });
}

export async function getTotalVotes(trackId: string) {
  const votes = await prisma.trackVote.groupBy({
    by: ['vote'],
    where: { trackId },
    _count: true,
  });

  let likes = 0,
    dislikes = 0;
  votes.forEach((row) => {
    if (row.vote === 'like') likes = row._count;
    if (row.vote === 'dislike') dislikes = row._count;
  });

  return { likes, dislikes };
}

export async function getUserVote(trackId: string, discordId: string) {
  const vote = await prisma.trackVote.findUnique({
    where: {
      trackId_discordId: {
        trackId,
        discordId,
      },
    },
    select: { vote: true },
  });

  return vote?.vote || null;
}
