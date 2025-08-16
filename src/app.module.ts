import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { IndexationModule } from './indexation/indexation.module';
import { McpEntryModule } from './mcp-entry/mcp-entry.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';



@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
    }),
    CommonModule,
    IndexationModule,
    McpEntryModule,
    UserModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule { }
