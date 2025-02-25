import { prisma } from '../lib/prisma';

export async function addFriend(userId: string, friendId: string) {
  return prisma.friend.create({
    data: {
      userId,
      friendId,
      status: 'pending',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    },
  });
}

export async function acceptFriend(userId: string, friendId: string) {
  return prisma.friend.update({
    where: {
      userId_friendId: {
        userId: friendId,
        friendId: userId,
      },
    },
    data: {
      status: 'accepted',
      updatedAt: Math.floor(Date.now() / 1000),
    },
  });
}

export async function declineFriend(userId: string, friendId: string) {
  return prisma.friend.delete({
    where: {
      userId_friendId: {
        userId: friendId,
        friendId: userId,
      },
    },
  });
}

export async function getPendingRequests(userId: string) {
  return prisma.friend.findMany({
    where: {
      friendId: userId,
      status: 'pending',
    },
    select: {
      userId: true,
      createdAt: true,
    },
  });
}

export async function removeFriend(userId: string, friendId: string) {
  await prisma.friend.deleteMany({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  });
}

export async function getFriendsList(userId: string) {
  return prisma.friend
    .findMany({
      where: {
        OR: [
          { userId, status: 'accepted' },
          { friendId: userId, status: 'accepted' },
        ],
      },
      select: {
        userId: true,
        friendId: true,
        createdAt: true,
      },
    })
    .then((friends) =>
      friends.map((friend) => ({
        friend_id: friend.userId === userId ? friend.friendId : friend.userId,
        added_at: friend.createdAt,
      }))
    );
}

export async function getFriendship(userId: string, friendId: string) {
  return prisma.friend.findFirst({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId },
      ],
    },
  });
}

export async function getFriendCount(userId: string) {
  return prisma.friend.count({
    where: {
      OR: [{ userId }, { friendId: userId }],
    },
  });
}

export async function getMutualFriends(user1: string, user2: string) {
  return prisma.$queryRaw`
    SELECT DISTINCT f1.friend_id
    FROM friends f1
    INNER JOIN friends f2 ON f1.friend_id = f2.friend_id
    WHERE (f1.user_id = ${user1} AND f2.user_id = ${user2})
    AND f1.friend_id NOT IN (${user1}, ${user2})
  `;
}

export async function areFriends(user1: string, user2: string): Promise<boolean> {
  const friendship = await prisma.friend.findFirst({
    where: {
      userId: user1,
      friendId: user2,
      status: 'accepted',
    },
  });
  return !!friendship;
}
