"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../generated/prisma");
const prisma = new prisma_1.PrismaClient();
async function main() {
    await prisma.user.deleteMany({});
    await prisma.user.createMany({
        data: [
            { email: 'test1@example.com', name: 'Test User 1' },
            { email: 'test2@example.com', name: 'Test User 2' },
        ],
    });
    console.log('Seeding complete!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map