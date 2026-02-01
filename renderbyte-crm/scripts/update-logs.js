const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const result = await prisma.activityLog.updateMany({
        where: {
            type: "STATUS_CHANGE"
        },
        data: {
            type: "MENSAJE_ENVIADO"
        }
    });
    console.log(`Updated ${result.count} logs from STATUS_CHANGE to MENSAJE_ENVIADO.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
