import { Database } from 'sqlite';
import { getDB } from './database';  // Changed from initDB to getDB

// Add status to friends table
export async function setupFriendsTable() {
  const db = await getDB();
  
  await db.run('DROP TABLE IF EXISTS friends');
  
  await db.run(`
    CREATE TABLE IF NOT EXISTS friends (
      user_id TEXT,
      friend_id TEXT,
      added_at INTEGER,
      status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
      PRIMARY KEY (user_id, friend_id)
    )
  `);
}

export async function addFriend(userId: string, friendId: string) {
  await setupFriendsTable();
  const db = await getDB();
  const timestamp = Date.now();
  return db.run(
    'INSERT OR REPLACE INTO friends (user_id, friend_id, added_at, status) VALUES (?, ?, ?, ?)',
    userId, friendId, timestamp, 'pending'
  );
}

export async function acceptFriend(userId: string, friendId: string) {
  const db = await getDB();
  await db.run(
    'UPDATE friends SET status = ? WHERE user_id = ? AND friend_id = ?',
    'accepted', friendId, userId
  );
}

export async function declineFriend(userId: string, friendId: string) {
  const db = await getDB();
  await db.run(
    'UPDATE friends SET status = ? WHERE user_id = ? AND friend_id = ?',
    'declined', friendId, userId
  );
}

export async function getPendingRequests(userId: string) {
  const db = await getDB();
  return db.all(
    'SELECT user_id, added_at FROM friends WHERE friend_id = ? AND status = ?',
    userId, 'pending'
  );
}

export async function removeFriend(userId: string, friendId: string) {
  await setupFriendsTable();
  const db = await getDB();
  return db.run(
    'DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
    userId, friendId, friendId, userId
  );
}

export async function getFriendsList(userId: string) {
  await setupFriendsTable();
  const db = await getDB();
  return db.all('SELECT friend_id, added_at FROM friends WHERE user_id = ?', userId);
}

export async function getFriendship(userId: string, friendId: string) {
  await setupFriendsTable();
  const db = await getDB();
  return db.get(
    'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
    userId, friendId, friendId, userId
  );
}

export async function getFriendCount(userId: string) {
  await setupFriendsTable();
  const db = await getDB();
  const result = await db.get(
    'SELECT COUNT(*) as count FROM friends WHERE user_id = ? OR friend_id = ?',
    userId, userId
  );
  return result.count;
}

export async function getMutualFriends(user1: string, user2: string) {
  await setupFriendsTable();
  const db = await getDB();
  return db.all(`
    SELECT DISTINCT f1.friend_id
    FROM friends f1
    INNER JOIN friends f2 ON f1.friend_id = f2.friend_id
    WHERE (f1.user_id = ? AND f2.user_id = ?)
    AND f1.friend_id NOT IN (?, ?)
  `, user1, user2, user1, user2);
}

export async function areFriends(user1: string, user2: string): Promise<boolean> {
  const db = await getDB();
  const friendship = await db.get(
    'SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = ?',
    user1, user2, 'accepted'
  );
  return !!friendship;
}

