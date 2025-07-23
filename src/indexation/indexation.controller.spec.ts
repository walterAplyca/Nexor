import { Test, TestingModule } from '@nestjs/testing';
import { IndexationController } from './indexation.controller';
import { IndexationService } from './indexation.service';

describe('IndexationController', () => {
  let controller: IndexationController;
  let service: IndexationService;

  beforeEach(async () => {
    const mockIndexationService = {
      indexationDocuments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IndexationController],
      providers: [
        {
          provide: IndexationService,
          useValue: mockIndexationService,
        },
      ],
    }).compile();

    controller = module.get<IndexationController>(IndexationController);
    service = module.get<IndexationService>(IndexationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('indexationDocuments', () => {
    it('debería retornar el resultado del servicio', async () => {
      const mockResult = { files: ['doc1', 'doc2'] };
      (service.indexationDocuments as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.getRecentFiles('folderId');
      expect(result).toBe(mockResult);
      expect(service.indexationDocuments).toHaveBeenCalledWith('folderId');
    });

    it('debería lanzar un error si el servicio falla', async () => {
      (service.indexationDocuments as jest.Mock).mockRejectedValue(new Error('fail'));

      await expect(controller.getRecentFiles('folderId')).rejects.toThrow('fail');
    });
  });
});
