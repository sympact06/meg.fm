import { copyFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const BACKUP_DIR = './backups';
const MAX_BACKUPS = 7; // Keep a week's worth of backups

export async function createBackup(): Promise<void> {
  // Ensure backup directory exists
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, '-');
  const dbPath = process.env.DATABASE_PATH || './data.sqlite';
  const backupPath = join(BACKUP_DIR, `backup-${timestamp}.sqlite`);

  try {
    // Wait for any pending writes
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create backup
    await copyFile(dbPath, backupPath);
    console.log(`Database backup created: ${backupPath}`);

    // Clean up old backups
    await cleanOldBackups();
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
}

async function cleanOldBackups(): Promise<void> {
  const fs = await import('fs/promises');
  const files = await fs.readdir(BACKUP_DIR);

  // Sort backups by date (newest first)
  const backups = files
    .filter((file) => file.startsWith('backup-') && file.endsWith('.sqlite'))
    .sort()
    .reverse();

  // Remove excess backups
  for (let i = MAX_BACKUPS; i < backups.length; i++) {
    const backupPath = join(BACKUP_DIR, backups[i]);
    await fs.unlink(backupPath);
    console.log(`Removed old backup: ${backups[i]}`);
  }
}
