import { Test, TestingModule } from '@nestjs/testing';
import { EnvioEmailController } from './envio-email.controller';

describe('EnvioEmailController', () => {
  let controller: EnvioEmailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnvioEmailController],
    }).compile();

    controller = module.get<EnvioEmailController>(EnvioEmailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
