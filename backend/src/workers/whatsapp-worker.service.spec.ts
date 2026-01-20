import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappWorkerService } from './whatsapp-worker.service';
import { PrismaService } from '../prisma/prisma.service';
import { Job } from 'bullmq';
import { waitForLocks, releaseLock, renewLock } from '../common/redis-lock.utils';

// --- Mocks ---

// 1. In-memory Lock Simulation
const lockedKeys = new Set<string>();

jest.mock('../common/redis-lock.utils', () => ({
    waitForLocks: jest.fn(async (redis, keys, ttl) => {
        // Simple polling simulation
        const start = Date.now();
        while (keys.some(k => lockedKeys.has(k))) {
            await new Promise(r => setTimeout(r, 50)); // Check every 50ms
            if (Date.now() - start > 2000) throw new Error('Lock timeout in test');
        }
        keys.forEach(k => lockedKeys.add(k));
    }),
    releaseLock: jest.fn(async (redis, key) => {
        lockedKeys.delete(key);
    }),
    renewLock: jest.fn(),
}));

// 2. Mock Redis
const mockRedisClient = {
    publish: jest.fn(),
    subscribe: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
};

// 3. Mock Prisma
const mockPrismaService = {
    campaña: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    reporte: {
        findMany: jest.fn(),
        create: jest.fn(),
    },
    contacto: {
        findMany: jest.fn(),
    },
    sesion: {
        findUnique: jest.fn(),
    },
    mensaje: {
        create: jest.fn(),
    },
};

describe('WhatsappWorkerService Concurrency', () => {
    let service: WhatsappWorkerService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WhatsappWorkerService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: 'REDIS_CLIENT', useValue: mockRedisClient },
                { provide: 'REDIS_SUB', useValue: mockRedisClient },
            ],
        }).compile();

        service = module.get<WhatsappWorkerService>(WhatsappWorkerService);

        // Reset state
        lockedKeys.clear();
        jest.clearAllMocks();

        // Default Prisma mocks
        mockPrismaService.campaña.findUnique.mockResolvedValue({ id: 1, estado: 'programada' });
        mockPrismaService.reporte.findMany.mockResolvedValue([]);
        mockPrismaService.sesion.findUnique.mockResolvedValue({ ani: 'test-ani' });

        // Mock internal waiting to be fast but async
        jest.spyOn(service as any, 'esperarRespuesta').mockImplementation(async () => {
            await new Promise(r => setTimeout(r, 10)); // Simulate minimal network delay
            return { estado: 'enviado' };
        });
    });

    // Helper to create a dummy job
    const createJob = (id: string, campaignId: number, sessions: string[], delayMs: number = 0) => ({
        id,
        data: {
            sessionIds: sessions,
            campaña: campaignId,
            config: {
                batchSize: 10,
                delayEntreMensajes: delayMs, // Controllable delay per message to simulate work duration
                delayEntreLotes: 0,
            },
        },
    } as unknown as Job);

    it('should process two jobs SEQUENTIALLY if they share the same session', async () => {
        // Mock contacts: Job 1 has 2 contacts, Job 2 has 1
        // processing time job 1 ~= 2 * 100ms = 200ms
        // processing time job 2 ~= 1 * 100ms = 100ms
        mockPrismaService.contacto.findMany.mockResolvedValue([
            { id: 1, numero: '111', mensaje: 'msg' },
            { id: 2, numero: '222', mensaje: 'msg' }
        ]);

        const job1 = createJob('job1', 1, ['session-A'], 100);
        const job2 = createJob('job2', 2, ['session-A'], 50);

        const start = Date.now();

        // Run both "simultaneously"
        const p1 = service.procesarJob(job1).then(() => Date.now());
        const p2 = service.procesarJob(job2).then(() => Date.now());

        const [end1, end2] = await Promise.all([p1, p2]);

        // Job 1 should finish first (it grabbed the lock first presumably, or one waited)
        // Actually, promise execution order isn't guaranteed, but the lock ensures serialized execution.
        // The total time should be roughly sum of parts (200 + 50 + overhead).
        // Checking purely timestamps might be flaky, but we can check if they overlapped.

        // Better verification: Check if lockedKeys contained 'wa_session_lock:session-A' during the wait? 
        // Our mock implementation handles the wait. 

        // We can verify that execution time is at least sum of delays (approx 200+50 = 250ms)
        // If they ran in parallel, it would be around max(200, 50) = 200ms.

        const duration = Math.max(end1, end2) - start;
        console.log(`Sequential execution duration: ${duration}ms`);

        // Expect duration to be significant (serializing)
        // 2 contacts * 100ms + 2 contacts * 50ms (simulated finding) = Actually job 2 will use same mock contacts (2 contacts)
        // because mockPrismaService.contacto.findMany returns 2 items always.
        // So Job 1: 2 * 100ms = 200ms
        // Job 2: 2 * 50ms = 100ms
        // Total sequential: ~300ms. Parallel: ~200ms.
        expect(duration).toBeGreaterThanOrEqual(300);
    });

    it('should process two jobs IN PARALLEL if they use different sessions', async () => {
        mockPrismaService.contacto.findMany.mockResolvedValue([
            { id: 1, numero: '111', mensaje: 'msg' },
            { id: 2, numero: '222', mensaje: 'msg' }
        ]);

        const jobA = createJob('jobA', 1, ['session-X'], 100); // ~200ms
        const jobB = createJob('jobB', 2, ['session-Y'], 100); // ~200ms

        const start = Date.now();

        const pA = service.procesarJob(jobA).then(() => Date.now());
        const pB = service.procesarJob(jobB).then(() => Date.now());

        const [endA, endB] = await Promise.all([pA, pB]);

        const duration = Math.max(endA, endB) - start;
        console.log(`Parallel execution duration: ${duration}ms`);

        // If sequential, would be ~400ms.
        // If parallel, should be ~200ms + overhead.
        // We expect it to be much less than sum.
        expect(duration).toBeLessThan(350);
    });
});
