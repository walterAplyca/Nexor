import { Test, TestingModule } from '@nestjs/testing';
import { IndexationService } from './indexation.service';

describe('IndexationService', () => {
  let service: IndexationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IndexationService],
    }).compile();

    service = module.get<IndexationService>(IndexationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
