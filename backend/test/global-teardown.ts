export default function globalTeardown() {
  // Optionally clear the database after all tests are done
  // For now, we'll just log that teardown is complete.
  console.log(
    '\n[Global Teardown] All tests finished. Database state preserved.',
  );
  // If you want to clear the database after tests, you could run:
  // execSync('docker compose exec backend sh -c "cd backend && npx prisma db push --force --skip-generate" --schema=./prisma/schema.prisma', { stdio: 'inherit' });
}
