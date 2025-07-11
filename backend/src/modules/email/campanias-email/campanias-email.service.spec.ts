import { Test, TestingModule } from '@nestjs/testing';
import { CampaniasEmailService } from './campanias-email.service';

describe('CampaniasEmailService', () => {
  let service: CampaniasEmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CampaniasEmailService],
    }).compile();

    service = module.get<CampaniasEmailService>(CampaniasEmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
