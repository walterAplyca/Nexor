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
    // Simula que drive está inicializado
    service['drive'] = {
      files: {
        list: jest.fn(),
        get: jest.fn(),
      },
    } as any;
    // Simula initDrive
    // Mock initDrive directly since TypeScript cannot infer its type if not declared in the class
    (service as any).initDrive = jest.fn().mockImplementation(async () => {
      service['drive'] = {
        files: {
          list: jest.fn(),
          get: jest.fn(),
        },
      } as any;
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getModifiedFilesInLast24Hours', () => {
    it('debería llamar a initDrive si drive no está inicializado', async () => {
      service['drive'] = undefined; // Asegura que está sin inicializar
      const initSpy = jest.spyOn(service as any, 'initDrive');
      // Mockea el método list en el drive que se crea en initDrive
      (service as any).initDrive.mockImplementation(async () => {
        service['drive'] = {
          files: {
            list: jest.fn().mockResolvedValue({ data: { files: [] } }),
            get: jest.fn(),
          },
        } as any;
      });
      await service.getModifiedFilesInLast24Hours('carpetaId');
      expect(initSpy).toHaveBeenCalled();
    });

    it('debería construir correctamente el query y retornar archivos si existen', async () => {
      const mockFiles = [
        { id: '1', name: 'archivo.pdf', modifiedTime: new Date().toISOString(), mimeType: 'application/pdf' },
        { id: '2', name: 'archivo.docx', modifiedTime: new Date().toISOString(), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      ];
      (service['drive'].files.list as jest.Mock).mockResolvedValue({ data: { files: mockFiles } });

      const result = await service.getModifiedFilesInLast24Hours('carpetaId');
      expect(result.message).toBe('Archivos modificados en las últimas 24 horas encontrados.');
      expect(result.files).toEqual(mockFiles);
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files.length).toBe(2);
      expect(service['drive'].files.list).toHaveBeenCalledWith(expect.objectContaining({
        q: expect.stringContaining('carpetaId'),
        fields: expect.stringContaining('files('),
      }));
    });

    it('debería retornar mensaje y arreglo vacío si no hay archivos', async () => {
      (service['drive'].files.list as jest.Mock).mockResolvedValue({ data: { files: [] } });
      const result = await service.getModifiedFilesInLast24Hours('carpetaId');
      expect(result).toEqual({
        message: 'No hay archivos modificados en las últimas 24 horas.',
        files: [],
      });
    });

    it('debería retornar mensaje y arreglo vacío si files es undefined', async () => {
      (service['drive'].files.list as jest.Mock).mockResolvedValue({ data: {} });
      const result = await service.getModifiedFilesInLast24Hours('carpetaId');
      expect(result).toEqual({
        message: 'No hay archivos modificados en las últimas 24 horas.',
        files: [],
      });
    });
  });
});
