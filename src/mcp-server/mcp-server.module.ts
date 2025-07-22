import { Module } from '@nestjs/common';
import { McpServerService } from './mcp-server.service';

@Module({
  providers: [McpServerService]
})
export class McpServerModule {}
