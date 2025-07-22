import { Test, TestingModule } from '@nestjs/testing';
import { McpServerService } from './mcp-server.service';

describe('McpServerService', () => {
  let service: McpServerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [McpServerService],
    }).compile();

    service = module.get<McpServerService>(McpServerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
