import { execSync } from 'child_process';

export default function globalSetup() {
  // Ensure the database is up and migrated
  // This assumes docker-compose is running and the 'db' service is available
  // and that migrations have been applied (e.g., by running `npm run prisma:migrate` once)

  // Seed the database before running tests
  console.log('\n[Global Setup] Seeding database...');
  try {
    execSync(
      'docker compose exec backend sh -c "cd backend && npm run prisma:seed"',
      { stdio: 'inherit' },
    );
    console.log('[Global Setup] Database seeded.');
  } catch {
    console.log(
      '[Global Setup] Database seeding skipped (likely not in Docker environment)',
    );
  }
}
