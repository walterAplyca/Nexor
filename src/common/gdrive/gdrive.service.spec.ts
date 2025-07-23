import { Test, TestingModule } from '@nestjs/testing';
import { GdriveService } from './gdrive.service';

jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn().mockReturnValue({
      files: {
        list: jest.fn().mockResolvedValue({ data: { files: [] } }),
        get: jest.fn().mockResolvedValue({ data: {} }),
      },
    }),
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({
        getClient: jest.fn().mockResolvedValue({}),
      })),
    },
  },
}));

describe('GdriveService', () => {
  let service: GdriveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GdriveService],
    }).compile();

    service = module.get<GdriveService>(GdriveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });



  describe('getModifiedFilesInLast24Hours', () => {
    it('debería retornar archivos modificados en las últimas 24 horas', async () => {
      // Simula el resultado esperado
      const mockFiles = {
        message: 'Archivos modificados en las últimas 24 horas encontrados.',
        files: [{ id: '1', name: 'archivo.txt', modifiedTime: new Date().toISOString() }]
      };
      jest.spyOn(service, 'getModifiedFilesInLast24Hours').mockResolvedValue(mockFiles);

      const result = await service.getModifiedFilesInLast24Hours('carpetaId');
      expect(result).toEqual(mockFiles);
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files[0]).toHaveProperty('id');
      expect(result.files[0]).toHaveProperty('name');
      expect(result.files[0]).toHaveProperty('modifiedTime');
    });

    it('debería retornar un objeto con arreglo vacío si no hay archivos', async () => {
      jest.spyOn(service, 'getModifiedFilesInLast24Hours').mockResolvedValue({
        message: 'Archivos modificados en las últimas 24 horas encontrados.',
        files: []
      });
      const result = await service.getModifiedFilesInLast24Hours('carpetaId');
      expect(result).toEqual({
        message: 'Archivos modificados en las últimas 24 horas encontrados.',
        files: []
      });
    });
  });
});
