import { Test, TestingModule } from '@nestjs/testing';
import { SesionesService } from './sesiones.service';

describe('SesionesService', () => {
  let service: SesionesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SesionesService],
    }).compile();

    service = module.get<SesionesService>(SesionesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
