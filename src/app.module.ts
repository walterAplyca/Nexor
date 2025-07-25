import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { IndexationModule } from './indexation/indexation.module';
import { McpEntryModule } from './mcp-entry/mcp-entry.module';





@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    IndexationModule,
    McpEntryModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule { }
