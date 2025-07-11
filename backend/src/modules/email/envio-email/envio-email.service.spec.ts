import { Test, TestingModule } from '@nestjs/testing';
import { EnvioEmailService } from './envio-email.service';

describe('EnvioEmailService', () => {
  let service: EnvioEmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnvioEmailService],
    }).compile();

    service = module.get<EnvioEmailService>(EnvioEmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
