import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
    const username = 'render'
    const password = 'byte'

    const user = await prisma.user.findUnique({
        where: { username }
    })

    if (!user) {
        console.log(`User ${username} not found. Creating...`)
        const hashedPassword = await bcrypt.hash(password, 10)
        await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name: 'Admin',
                role: 'ADMIN'
            }
        })
        console.log(`User ${username} created successfully.`)
    } else {
        console.log(`User ${username} already exists with role ${user.role}.`)
        // Update password just in case
        const hashedPassword = await bcrypt.hash(password, 10)
        await prisma.user.update({
            where: { username },
            data: { password: hashedPassword, role: 'ADMIN' }
        })
        console.log(`User ${username} credentials updated.`)
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
