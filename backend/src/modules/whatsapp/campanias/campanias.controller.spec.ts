import { Test, TestingModule } from '@nestjs/testing';
import { CampaniasController } from './campanias.controller';

describe('CampaniasController', () => {
  let controller: CampaniasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaniasController],
    }).compile();

    controller = module.get<CampaniasController>(CampaniasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
