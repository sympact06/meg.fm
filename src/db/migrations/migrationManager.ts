import { Database } from 'sqlite';
import * as initialSchema from './001_initial_schema';

interface Migration {
  up: (db: Database) => Promise<void>;
  down: (db: Database) => Promise<void>;
}

const migrations: Migration[] = [initialSchema];

export async function initMigrationTable(db: Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);
}

export async function getMigrationsStatus(db: Database): Promise<string[]> {
  await initMigrationTable(db);
  const result = await db.all('SELECT name FROM migrations ORDER BY id');
  return result.map((row) => row.name);
}

export async function migrateUp(db: Database): Promise<void> {
  await initMigrationTable(db);

  console.log('Starting database migration...');

  try {
    await db.run('BEGIN TRANSACTION');

    const appliedMigrations = await getMigrationsStatus(db);

    for (let i = 0; i < migrations.length; i++) {
      const migrationName = `migration_${(i + 1).toString().padStart(3, '0')}`;

      if (!appliedMigrations.includes(migrationName)) {
        console.log(`Applying migration: ${migrationName}`);
        await migrations[i].up(db);
        await db.run(
          'INSERT INTO migrations (name, applied_at) VALUES (?, ?)',
          migrationName,
          Date.now()
        );
      }
    }

    await db.run('COMMIT');
    console.log('Database migration completed successfully');
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  }
}

export async function migrateDown(db: Database): Promise<void> {
  await initMigrationTable(db);

  try {
    await db.run('BEGIN TRANSACTION');

    const appliedMigrations = await getMigrationsStatus(db);

    if (appliedMigrations.length > 0) {
      const lastMigration = migrations[appliedMigrations.length - 1];
      console.log(`Rolling back migration: ${appliedMigrations[appliedMigrations.length - 1]}`);

      await lastMigration.down(db);
      await db.run(
        'DELETE FROM migrations WHERE name = ?',
        appliedMigrations[appliedMigrations.length - 1]
      );
    }

    await db.run('COMMIT');
    console.log('Database rollback completed successfully');
  } catch (error) {
    await db.run('ROLLBACK');
    console.error('Rollback failed:', error);
    throw error;
  }
}
