import { getDB } from './database';

interface ProfileCustomization {
  accent_color?: string;
  banner?: string;
}

export async function setupProfilesTable() {
  const db = await getDB();
  await db.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      discordId TEXT PRIMARY KEY,
      accent_color TEXT DEFAULT '#1DB954',
      banner TEXT DEFAULT 'default'
    )
  `);
}

export async function getUserProfile(discordId: string) {
  const db = await getDB();
  await setupProfilesTable();
  
  const profile = await db.get(
    'SELECT * FROM user_profiles WHERE discordId = ?',
    discordId
  );

  return profile || { accent_color: '#1DB954', banner: 'default' };
}

export async function updateUserProfile(discordId: string, customization: ProfileCustomization) {
  const db = await getDB();
  await setupProfilesTable();

  const sets = [];
  const values = [];
  
  if (customization.accent_color) {
    sets.push('accent_color = ?');
    values.push(customization.accent_color);
  }
  
  if (customization.banner) {
    sets.push('banner = ?');
    values.push(customization.banner);
  }

  if (sets.length === 0) return;

  values.push(discordId);
  await db.run(`
    INSERT INTO user_profiles (discordId, ${sets.map(s => s.split('=')[0]).join(', ')})
    VALUES (?, ${Array(sets.length).fill('?').join(', ')})
    ON CONFLICT(discordId) DO UPDATE SET ${sets.join(', ')}
  `, ...values);
}
