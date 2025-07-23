import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { IndexationModule } from './indexation/indexation.module';





@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    IndexationModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule { }
