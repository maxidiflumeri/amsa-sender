import { Test, TestingModule } from '@nestjs/testing';
import { TemplatesEmailController } from './templates-email.controller';

describe('TemplatesEmailController', () => {
  let controller: TemplatesEmailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplatesEmailController],
    }).compile();

    controller = module.get<TemplatesEmailController>(TemplatesEmailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
