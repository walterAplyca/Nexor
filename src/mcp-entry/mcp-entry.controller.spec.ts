import { Test, TestingModule } from '@nestjs/testing';
import { McpEntryController } from './mcp-entry.controller';

describe('McpEntryController', () => {
  let controller: McpEntryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpEntryController],
    }).compile();

    controller = module.get<McpEntryController>(McpEntryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
