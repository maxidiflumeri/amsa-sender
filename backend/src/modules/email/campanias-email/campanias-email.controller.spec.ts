import { Test, TestingModule } from '@nestjs/testing';
import { CampaniasEmailController } from './campanias-email.controller';

describe('CampaniasEmailController', () => {
  let controller: CampaniasEmailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaniasEmailController],
    }).compile();

    controller = module.get<CampaniasEmailController>(CampaniasEmailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
