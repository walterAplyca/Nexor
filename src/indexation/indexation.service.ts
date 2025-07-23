import { Injectable } from '@nestjs/common';
import { EmbeddingsService } from '../common/embeddings/embeddings.service';

@Injectable()
export class IndexationService {
    constructor(private readonly embeddingsService: EmbeddingsService) { }
    async indexationDocuments(folderId: string) {
        try {
            return await this.embeddingsService.indexByFileId(folderId);
        } catch (error) {
            console.error('Error en la indexación de documentos:', error);
            throw error;
        }
    }
}
