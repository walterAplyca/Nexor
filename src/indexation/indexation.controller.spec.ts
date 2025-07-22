import { Test, TestingModule } from '@nestjs/testing';
import { IndexationController } from './indexation.controller';

describe('IndexationController', () => {
  let controller: IndexationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IndexationController],
    }).compile();

    controller = module.get<IndexationController>(IndexationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
