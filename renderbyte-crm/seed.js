const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    // Passwords are hasheada with bcrypt
    const adminPassword = await hash('byte', 12);
    const admin = await prisma.user.upsert({
        where: { username: 'render' },
        update: {
            password: adminPassword,
            role: 'ADMIN'
        },
        create: {
            username: 'render',
            name: 'Admin Render',
            password: adminPassword,
            role: 'ADMIN',
        },
    });
    console.log('Seeded Admin:', admin.username);

    const setterPassword = await hash('setter123', 12);
    const setter = await prisma.user.upsert({
        where: { username: 'setter_test' },
        update: {},
        create: {
            username: 'setter_test',
            name: 'Test Setter',
            password: setterPassword,
            role: 'SETTER',
        },
    });
    console.log('Seeded Setter:', setter.username);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
