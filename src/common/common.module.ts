import { Module } from '@nestjs/common';
import { GdriveService } from './gdrive/gdrive.service';
import { EmbeddingsService } from './embeddings/embeddings.service';

@Module({
    providers: [GdriveService, EmbeddingsService],
    exports: [GdriveService],
})
export class CommonModule { }
