import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TODOS_LOS_PERMISOS = [
    'whatsapp.sesiones',
    'whatsapp.conectar',
    'whatsapp.campanias',
    'whatsapp.templates',
    'whatsapp.reportes',
    'whatsapp.metricas',
    'email.cuentas_smtp',
    'email.templates',
    'email.campanias',
    'email.envio_manual',
    'email.reportes',
    'email.desuscripciones',
    'config.tareas_programadas',
    'admin.usuarios',
    'wapi.respuestas_rapidas',
];

const PERMISOS_GESTOR = [
    'whatsapp.sesiones',
    'whatsapp.conectar',
    'whatsapp.campanias',
    'whatsapp.templates',
    'whatsapp.reportes',
    'whatsapp.metricas',
    'email.templates',
    'email.campanias',
    'email.envio_manual',
    'email.reportes',
    'email.desuscripciones',
];

async function main() {
    console.log('🌱 Ejecutando seed...');

    // 1. Crear roles base
    const rolFull = await prisma.rol.upsert({
        where: { nombre: 'full' },
        update: { permisos: TODOS_LOS_PERMISOS },
        create: { nombre: 'full', permisos: TODOS_LOS_PERMISOS },
    });

    const rolGestor = await prisma.rol.upsert({
        where: { nombre: 'gestor' },
        update: { permisos: PERMISOS_GESTOR },
        create: { nombre: 'gestor', permisos: PERMISOS_GESTOR },
    });

    console.log(`✅ Rol "full" (id: ${rolFull.id}) — ${TODOS_LOS_PERMISOS.length} permisos`);
    console.log(`✅ Rol "gestor" (id: ${rolGestor.id}) — ${PERMISOS_GESTOR.length} permisos`);

    // 2. Asignar roles a usuarios existentes
    const usuarios = await prisma.usuario.findMany();
    console.log(`👥 ${usuarios.length} usuario(s) encontrado(s)`);

    for (const u of usuarios) {
        const esAdmin =
            u.email.endsWith('@anamayasa.com.ar') ||
            u.email === 'maxidiflumeri@gmail.com' ||
            u.rol === 'admin';

        await prisma.usuario.update({
            where: { id: u.id },
            data: {
                rolId: esAdmin ? rolFull.id : rolGestor.id,
                rol: esAdmin ? 'full' : 'gestor',
                activo: true,
            },
        });

        console.log(`  → ${u.email}: ${esAdmin ? 'full' : 'gestor'}`);
    }

    console.log('✅ Seed completado.');
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
