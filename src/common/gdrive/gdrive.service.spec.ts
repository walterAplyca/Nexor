import { Test, TestingModule } from '@nestjs/testing';
import { GdriveService } from './gdrive.service';

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

  describe('listFiles', () => {
    it('debería retornar una lista de archivos', async () => {
      jest.spyOn(service, 'listFiles').mockResolvedValue([{ id: '1', name: 'archivo.txt' }]);
      const files = await service.listFiles();
      expect(Array.isArray(files)).toBe(true);
      expect(files[0]).toHaveProperty('id');
      expect(files[0]).toHaveProperty('name');
    });
  });

  describe('getFile', () => {
    it('debería retornar el contenido de un archivo', async () => {
      jest.spyOn(service, 'getFile').mockResolvedValue('contenido');
      const content = await service.getFile('1');
      expect(content).toBe('contenido');
    });
  });

  describe('uploadFile', () => {
    it('debería subir un archivo y retornar su id', async () => {
      jest.spyOn(service, 'uploadFile').mockResolvedValue('123');
      const fileId = await service.uploadFile('archivo.txt', Buffer.from('contenido'));
      expect(fileId).toBe('123');
    });
  });

  describe('deleteFile', () => {
    it('debería eliminar un archivo y retornar true', async () => {
      jest.spyOn(service, 'deleteFile').mockResolvedValue(true);
      const result = await service.deleteFile('1');
      expect(result).toBe(true);
    });
  });
});
