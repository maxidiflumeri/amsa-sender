import { Test, TestingModule } from '@nestjs/testing';
import { SesionesController } from './sesiones.controller';

describe('SesionesController', () => {
  let controller: SesionesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SesionesController],
    }).compile();

    controller = module.get<SesionesController>(SesionesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
