import { Test, TestingModule } from '@nestjs/testing';
import { IndexationService } from './indexation.service';
import { EmbeddingsService } from '../common/embeddings/embeddings.service';

describe('IndexationService', () => {
  let service: IndexationService;
  let embeddingsService: EmbeddingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexationService,
        {
          provide: EmbeddingsService,
          useValue: {
            indexByFileId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IndexationService>(IndexationService);
    embeddingsService = module.get<EmbeddingsService>(EmbeddingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('indexationDocuments', () => {
    it('debería retornar el resultado de embeddingsService.indexByFileId', async () => {
      const mockResult = { files: ['doc1', 'doc2'] };
      (embeddingsService.indexByFileId as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.indexationDocuments('folderId');
      expect(result).toBe(mockResult);
      expect(embeddingsService.indexByFileId).toHaveBeenCalledWith('folderId');
    });

    it('debería lanzar un error si embeddingsService.indexByFileId falla', async () => {
      (embeddingsService.indexByFileId as jest.Mock).mockRejectedValue(new Error('fail'));

      await expect(service.indexationDocuments('folderId')).rejects.toThrow('fail');
    });
  });
});
