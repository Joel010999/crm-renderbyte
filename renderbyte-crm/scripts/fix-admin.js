const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const username = 'render';
    const password = 'byte';

    try {
        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            console.log(`User ${username} not found. Creating...`);
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    name: 'Admin',
                    role: 'ADMIN'
                }
            });
            console.log(`User ${username} created successfully.`);
        } else {
            console.log(`User ${username} already exists with role ${user.role}. Updating password...`);
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.user.update({
                where: { username },
                data: { password: hashedPassword, role: 'ADMIN' }
            });
            console.log(`User ${username} credentials updated.`);
        }
    } catch (error) {
        console.error('Error during database operation:', error);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
