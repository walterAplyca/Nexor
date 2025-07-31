import { Test, TestingModule } from '@nestjs/testing';
import { GdriveService } from './gdrive.service';
import * as fs from 'fs';
import * as path from 'path';
import { Packer, Document } from 'docx';
import { v4 as uuidv4 } from 'uuid';


jest.mock('fs');
jest.mock('path');
jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('docx', () => {
  const original = jest.requireActual('docx');
  return {
    ...original,
    Packer: { toBuffer: jest.fn() },
    Document: jest.fn().mockImplementation(() => ({})),
    Paragraph: jest.fn(),
    Table: jest.fn(),
    TableRow: jest.fn(),
    TableCell: jest.fn(),
  };
});

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
  const mockContent = {
    title: 'Test Doc',
    generalDescription: 'Descripción general',
    tasks: ['Tarea 1', 'Tarea 2'],
    activities: [{ title: 'Act 1', hours: 2 }, { title: 'Act 2', hours: 3 }],
    deliveryTime: '2 días',
    notes: 'Notas adicionales',
  };

  beforeEach(async () => {
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'folder123';
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

    // Mock de path.join
    (path.join as jest.Mock).mockReturnValue('/tmp/temp-file.docx');
    // Mock de uuid
    (uuidv4 as jest.Mock).mockReturnValue('uuid-mock');
    // Mock de Packer.toBuffer
    (Packer.toBuffer as jest.Mock).mockResolvedValue(Buffer.from('doc-buffer'));
    // Mock de fs
    (fs.writeFileSync as jest.Mock).mockImplementation(() => { });
    (fs.createReadStream as jest.Mock).mockReturnValue('stream-mock');
    (fs.unlinkSync as jest.Mock).mockImplementation(() => { });
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

    it('crea y sube un documento correctamente y borra el archivo temporal', async () => {
      // Mock de drive.files.create
      const mockDriveCreate = jest.fn().mockResolvedValue({
        data: { id: 'fileId123', webViewLink: 'https://drive.link/fileId123' },
      });
      // @ts-ignore
      service.drive.files.create = mockDriveCreate;

      const result = await service.createAndUploadDocument(mockContent);

      // Verifica que se haya creado el documento y llamado a los métodos de fs y docx
      expect(Packer.toBuffer).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/temp-file.docx', expect.any(Buffer));
      expect(fs.createReadStream).toHaveBeenCalledWith('/tmp/temp-file.docx');
      expect(mockDriveCreate).toHaveBeenCalledWith(expect.objectContaining({
        requestBody: expect.objectContaining({
          name: 'Test Doc.docx',
          mimeType: 'application/vnd.google-apps.document',
          parents: ['folder123'],
        }),
        media: expect.objectContaining({
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          body: 'stream-mock',
        }),
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      }));
      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/temp-file.docx');
      expect(result).toEqual({
        fileId: 'fileId123',
        link: 'https://drive.link/fileId123',
      });
    });

    it('lanza error si drive.files.create falla y borra el archivo temporal', async () => {
      // Mock de drive.files.create que lanza error
      const mockDriveCreate = jest.fn().mockRejectedValue(new Error('Drive error'));
      // @ts-ignore
      service.drive.files.create = mockDriveCreate;

      await expect(service.createAndUploadDocument(mockContent)).rejects.toThrow('Drive error');
      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/temp-file.docx');
    });

    it('lanza error si Packer.toBuffer falla', async () => {
      (Packer.toBuffer as jest.Mock).mockRejectedValue(new Error('Buffer error'));
      await expect(service.createAndUploadDocument(mockContent)).rejects.toThrow('Buffer error');
      // El método intenta borrar el archivo aunque no exista
      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/temp-file.docx');
    });
  });
});


