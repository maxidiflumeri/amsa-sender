import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SERVICE_USER_EMAIL = 'amsa-gestion@interno';

async function main() {
    console.log('🌱 Seed service user para internal-api...');

    const existing = await prisma.usuario.findUnique({ where: { email: SERVICE_USER_EMAIL } });

    if (existing) {
        console.log(`ℹ️ Service user ya existe: id=${existing.id} email=${existing.email}`);
        return;
    }

    const usuario = await prisma.usuario.create({
        data: {
            email: SERVICE_USER_EMAIL,
            nombre: 'AMSA Gestión (service)',
            rol: 'service',
            activo: true,
            creadoAt: new Date(),
        },
    });

    console.log(`✅ Service user creado: id=${usuario.id} email=${usuario.email}`);
    console.log(`   Usalo en INTERNAL_API_KEYS como "serviceUserId": ${usuario.id}`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
