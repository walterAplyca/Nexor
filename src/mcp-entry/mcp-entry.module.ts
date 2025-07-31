import { Module } from '@nestjs/common';
import { ToolsService } from './tools/tools.service';
import { McpEntryController } from './mcp-entry.controller';
import { EmbeddingsService } from '../common/embeddings/embeddings.service';

@Module({
  providers: [ToolsService, EmbeddingsService],
  exports: [ToolsService],
  controllers: [McpEntryController]
})
export class McpEntryModule { }
