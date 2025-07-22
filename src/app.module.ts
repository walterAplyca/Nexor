import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { IndexationModule } from './indexation/indexation.module';
import { McpServerModule } from './mcp-server/mcp-server.module';




@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    IndexationModule,
    McpServerModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule { }
