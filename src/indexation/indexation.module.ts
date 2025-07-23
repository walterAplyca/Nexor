import { Module } from '@nestjs/common';
import { IndexationService } from './indexation.service';
import { IndexationController } from './indexation.controller';
import { EmbeddingsService } from '../common/embeddings/embeddings.service';

@Module({
  providers: [IndexationService, EmbeddingsService],
  controllers: [IndexationController]
})
export class IndexationModule { }
