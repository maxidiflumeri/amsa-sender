import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesEmailService } from './templates-email.service';

describe('TemplatesEmailService', () => {
  let service: TemplatesEmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TemplatesEmailService],
    }).compile();

    service = module.get<TemplatesEmailService>(TemplatesEmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
