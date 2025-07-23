import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingsService } from './embeddings.service';

// Mock de Pinecone
jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn().mockImplementation(() => ({
    Index: jest.fn().mockReturnValue({
      upsert: jest.fn().mockResolvedValue({}),
    }),
  })),
  PineconeRecord: jest.fn(),
}));

// Mock de OpenAI
jest.mock('openai', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      },
    })),
  };
});

// Mock de Google APIs
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

// Mocks adicionales para dependencias internas
jest.mock('../gdrive/gdrive.service', () => ({
  GdriveService: jest.fn().mockImplementation(() => ({
    getModifiedFilesInLast24Hours: jest.fn().mockResolvedValue({ files: [{ id: '1', name: 'test.pdf', mimeType: 'application/pdf' }] }),
  })),
}));

jest.mock('./utils/extract-text.util', () => ({
  extractTextFromDriveFile: jest.fn().mockResolvedValue('Texto extraído del archivo.'),
}));

// Mock para logger
const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

import { GdriveService } from '../gdrive/gdrive.service';
import { extractTextFromDriveFile } from './utils/extract-text.util'

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;

  beforeEach(async () => {
    // Variables de entorno simuladas
    process.env.PINECONE_API_KEY = 'fake-key';
    process.env.PINECONE_INDEX = 'fake-index';
    process.env.OPENAI_API_KEY = 'fake-openai-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmbeddingsService],
    }).compile();

    service = module.get<EmbeddingsService>(EmbeddingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('splitTextIntoChunks', () => {


    it('divide párrafos largos en oraciones', () => {
      const text = 'Este es un párrafo muy largo. Tiene varias oraciones. Y debe dividirse.';
      const result = service.splitTextIntoChunks(text, 30);
      expect(result.length).toBeGreaterThan(1);
      result.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(30));
    });

    it('omite párrafos vacíos', () => {
      const text = '\n\nTexto válido.\n\n';
      const result = service.splitTextIntoChunks(text, 50);
      expect(result).toEqual(['Texto válido.']);
    });

    it('devuelve arreglo vacío si el texto está vacío', () => {
      const result = service.splitTextIntoChunks('', 50);
      expect(result).toEqual([]);
    });
  });

  describe('canAddToChunk', () => {
    it('retorna true si el texto cabe en el chunk', () => {
      expect(service['canAddToChunk']('Hola', 'Mundo', 20)).toBe(true);
    });

    it('retorna false si el texto excede el chunk', () => {
      expect(service['canAddToChunk']('Hola', 'Mundo', 5)).toBe(false);
    });
  });

  describe('addToChunk', () => {
    it('agrega texto a chunk existente', () => {
      expect(service['addToChunk']('Hola', 'Mundo')).toBe('Hola\nMundo');
    });

    it('agrega texto a chunk vacío', () => {
      expect(service['addToChunk']('', 'Mundo')).toBe('Mundo');
    });
  });

  describe('processParagraph', () => {
    it('agrega párrafo corto directamente', () => {
      const chunks: string[] = [];
      service['processParagraph']('Texto corto.', 50, chunks);
      expect(chunks).toEqual(['Texto corto.']);
    });

    it('divide párrafo largo en oraciones', () => {
      const chunks: string[] = [];
      const longText = 'Oración uno. Oración dos. Oración tres.';
      service['processParagraph'](longText, 15, chunks);
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('splitLongParagraph', () => {
    it('divide párrafo largo en chunks por oraciones', () => {
      const chunks: string[] = [];
      const paragraph = 'Primera oración. Segunda oración. Tercera oración.';
      service['splitLongParagraph'](paragraph, 20, chunks);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(20));
    });
  });
});

describe('EmbeddingsService - cobertura extendida', () => {
  let service: EmbeddingsService;

  beforeEach(async () => {
    process.env.PINECONE_API_KEY = 'fake-key';
    process.env.PINECONE_INDEX = 'fake-index';
    process.env.OPENAI_API_KEY = 'fake-openai-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmbeddingsService],
    }).compile();

    service = module.get<EmbeddingsService>(EmbeddingsService);
    // @ts-ignore
    service.logger = mockLogger;
    // @ts-ignore
    service.drive = new GdriveService();
    // @ts-ignore
    service.openai = new (require('openai').default)();
    // @ts-ignore
    service.index = { upsert: jest.fn().mockResolvedValue({}) };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('indexByFileId retorna si no hay archivos', async () => {
    // @ts-ignore
    service.drive.getModifiedFilesInLast24Hours = jest.fn().mockResolvedValue({ files: [] });
    const result = await service.indexByFileId('fake-file-id');
    expect(result).toEqual({ files: [] });
  });

  it('indexByFileId procesa archivos si existen', async () => {
    // @ts-ignore
    service.processFile = jest.fn();
    await service.indexByFileId('fake-file-id');
    expect(service.processFile).toHaveBeenCalled();
  });

  it('indexByFileId maneja errores y los lanza', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // @ts-ignore
    service.drive.getModifiedFilesInLast24Hours = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(service.indexByFileId('fake-file-id')).rejects.toThrow('fail');
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('processFile omite si no hay texto', async () => {
    (extractTextFromDriveFile as jest.Mock).mockResolvedValueOnce('');
    await service.processFile({ id: '1', name: 'test', mimeType: 'application/pdf' });
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('no tiene texto legible'));
  });

  it('processFile omite si no hay chunks', async () => {
    (extractTextFromDriveFile as jest.Mock).mockResolvedValueOnce('   ');
    service.splitTextIntoChunks = jest.fn().mockReturnValue([]);
    await service.processFile({ id: '1', name: 'test', mimeType: 'application/pdf' });
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('no tiene texto legible después de dividir'));
  });

  it('processFile maneja error al crear embedding', async () => {
    service.splitTextIntoChunks = jest.fn().mockReturnValue(['chunk1']);
    // @ts-ignore
    service.openai.embeddings.create = jest.fn().mockRejectedValue(new Error('embedding error'));
    await service.processFile({ id: '1', name: 'test', mimeType: 'application/pdf' });
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error al procesar chunk'));
  });

  it('processFile maneja embedding vacío', async () => {
    service.splitTextIntoChunks = jest.fn().mockReturnValue(['chunk1']);
    // @ts-ignore
    service.openai.embeddings.create = jest.fn().mockResolvedValue({ data: [] });
    await service.processFile({ id: '1', name: 'test', mimeType: 'application/pdf' });
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('No se pudo generar embedding'));
  });

  it('processFile inserta vectores y loguea', async () => {
    service.splitTextIntoChunks = jest.fn().mockReturnValue(['chunk1']);
    // @ts-ignore
    service.openai.embeddings.create = jest.fn().mockResolvedValue({ data: [{ embedding: [1, 2, 3] }] });
    // @ts-ignore
    service.index.upsert = jest.fn().mockResolvedValue({});
    await service.processFile({ id: '1', name: 'test', mimeType: 'application/pdf' });
    expect(service['index'].upsert).toHaveBeenCalled();
    expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Se indexaron'));
  });

  it('processFile maneja error al insertar en Pinecone', async () => {
    service.splitTextIntoChunks = jest.fn().mockReturnValue(['chunk1']);
    // @ts-ignore
    service.openai.embeddings.create = jest.fn().mockResolvedValue({ data: [{ embedding: [1, 2, 3] }] });
    // @ts-ignore
    service.index.upsert = jest.fn().mockRejectedValue(new Error('pinecone error'));
    await service.processFile({ id: '1', name: 'test', mimeType: 'application/pdf' });
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error al insertar en Pinecone'));
  });

  it('processFile advierte si no hay vectores', async () => {
    service.splitTextIntoChunks = jest.fn().mockReturnValue(['chunk1']);
    // @ts-ignore
    service.openai.embeddings.create = jest.fn().mockResolvedValue({ data: [] });
    await service.processFile({ id: '1', name: 'test', mimeType: 'application/pdf' });
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('No se insertaron vectores'));
  });
});
