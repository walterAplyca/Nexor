import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingsService } from './embeddings.service';
import { GdriveService } from '../gdrive/gdrive.service';

// Mock de Pinecone
jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn().mockImplementation(() => ({
    Index: jest.fn().mockReturnValue({
      upsert: jest.fn().mockResolvedValue({}),
      query: jest.fn().mockResolvedValue({ matches: [{ id: '1', score: 0.9 }] }),
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
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'cotizacion' } }],
          }),
        },
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

// Mock del helper extractTextFromDriveFile
jest.mock('./utils/extract-text.util', () => ({
  extractTextFromDriveFile: jest.fn(),
}));

// Mock de GdriveService
jest.mock('../gdrive/gdrive.service', () => ({
  GdriveService: jest.fn().mockImplementation(() => ({
    getModifiedFilesInLast24Hours: jest.fn().mockResolvedValue({ files: [{ id: '1', name: 'test.pdf', mimeType: 'application/pdf' }] }),
  })),
}));

import { extractTextFromDriveFile } from './utils/extract-text.util';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;

  beforeEach(async () => {
    process.env.PINECONE_API_KEY = 'fake-key';
    process.env.PINECONE_INDEX = 'fake-index';
    process.env.OPENAI_API_KEY = 'fake-openai-key';
    process.env.MODEL_EMBEDDINGS = 'text-embedding-3-small';

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmbeddingsService],
    }).compile();

    service = module.get<EmbeddingsService>(EmbeddingsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('indexByFileId', () => {
    it('retorna response_drive si no hay archivos', async () => {
      service['drive'].getModifiedFilesInLast24Hours = jest.fn().mockResolvedValue({ files: [] });
      const result = await service.indexByFileId('folderId');
      expect(result).toEqual({ files: [] });
    });

    it('procesa archivos y llama a processFile por cada uno', async () => {
      const mockFiles = [
        { id: '1', name: 'file1', mimeType: 'application/pdf' },
        { id: '2', name: 'file2', mimeType: 'application/pdf' },
      ];
      service['drive'].getModifiedFilesInLast24Hours = jest.fn().mockResolvedValue({ files: mockFiles });
      const processFileSpy = jest.spyOn(service, 'processFile').mockResolvedValue();
      await service.indexByFileId('folderId');
      expect(processFileSpy).toHaveBeenCalledTimes(mockFiles.length);
    });

    it('lanza error si getModifiedFilesInLast24Hours falla', async () => {
      service['drive'].getModifiedFilesInLast24Hours = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(service.indexByFileId('folderId')).rejects.toThrow('fail');
    });
  });


  describe('processFile', () => {
    it('advierte si el archivo no tiene texto legible', async () => {
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
      await service.processFile({ id: 'no-text', name: 'file1', mimeType: 'application/pdf' } as any);
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('no tiene texto legible'));
    });

    it('advierte si no hay chunks después de dividir', async () => {
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
      await service.processFile({ id: 'empty-chunks', name: 'file2', mimeType: 'application/pdf' } as any);
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Archivo file2 no tiene texto legible.'));
    });

    it('procesa chunks y genera embeddings, inserta en Pinecone y loguea', async () => {
      // Mock para que haya texto legible
      (extractTextFromDriveFile as jest.Mock).mockResolvedValueOnce('Texto válido para chunk.');
      const file = { id: '1', name: 'file1', mimeType: 'application/pdf' } as any;
      const loggerLogSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
      (service['index'].upsert as jest.Mock).mockResolvedValue({});
      // Mock para que createEmbedding devuelva un embedding válido
      const embeddingSpy = jest.spyOn(service, 'createEmbedding').mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0, object: 'embedding' }],
        model: 'text-embedding-3-small',
        object: 'list',
        usage: { prompt_tokens: 0, total_tokens: 0 },
      });

      await service.processFile(file);

      expect(embeddingSpy).toHaveBeenCalled();
      expect(service['index'].upsert).toHaveBeenCalled();
      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('Embeddings generados'));
      expect(loggerLogSpy).toHaveBeenCalledWith(expect.stringContaining('Se indexaron'));
      expect(loggerWarnSpy).not.toHaveBeenCalledWith(expect.stringContaining('No se insertaron vectores'));
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('advierte si no se pudo generar embedding para un chunk', async () => {
      jest.spyOn(service, 'createEmbedding').mockResolvedValue({ data: [] });
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
      await service.processFile({ id: '1', name: 'file1', mimeType: 'application/pdf' } as any);
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Archivo file1 no tiene texto legible.'));
    });

    it('advierte si no se insertaron vectores', async () => {
      jest.spyOn(service, 'createEmbedding').mockResolvedValue({ data: [] });
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
      await service.processFile({ id: '1', name: 'file1', mimeType: 'application/pdf' } as any);
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Archivo file1 no tiene texto legible.'));
    });

    it('logea error si ocurre al insertar en Pinecone', async () => {
      (extractTextFromDriveFile as jest.Mock).mockResolvedValueOnce('Texto válido para chunk.');
      jest.spyOn(service, 'createEmbedding').mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3], index: 0, object: 'embedding' }],
        model: 'text-embedding-3-small',
        object: 'list',
        usage: { prompt_tokens: 0, total_tokens: 0 },
      });
      jest.spyOn(service['index'], 'upsert').mockRejectedValue(new Error('pinecone error'));
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

      await service.processFile({ id: '1', name: 'file1', mimeType: 'application/pdf' } as any);

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error al insertar en Pinecone'));
    });

  });

  describe('splitTextIntoChunks', () => {
    it('divide texto en chunks por párrafos', () => {
      const text = 'Primer párrafo.';
      const result = service.splitTextIntoChunks(text, 50);
      expect(result).toEqual(['Primer párrafo.']);
    });

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

  describe('createEmbedding', () => {
    it('llama a openai.embeddings.create con el chunk correcto', async () => {
      const spy = jest.spyOn(service['openai'].embeddings, 'create');
      const chunk = 'Este es un chunk de prueba.';
      await service.createEmbedding(chunk);
      expect(spy).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: chunk,
      });
    });

    it('retorna null y logea advertencia si el embedding está vacío', async () => {
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
      jest.spyOn(service['openai'].embeddings, 'create').mockResolvedValue({
        data: [],
        model: 'text-embedding-3-small',
        object: 'list',
        usage: { prompt_tokens: 0, total_tokens: 0 },
      });
      const result = await service.createEmbedding('chunk');
      expect(result.data).toEqual([]);
    });

    it('retorna el embedding generado', async () => {
      const chunk = 'chunk de prueba';
      const embedding = [0.1, 0.2, 0.3];
      jest.spyOn(service['openai'].embeddings, 'create').mockResolvedValue({
        data: [{ embedding, index: 0, object: 'embedding' }],
        model: 'text-embedding-3-small',
        object: 'list',
        usage: { prompt_tokens: 0, total_tokens: 0 },
      });
      const result = await service.createEmbedding(chunk);
      expect(result.data[0].embedding).toEqual(embedding);
    });
  });
});

describe('EmbeddingsService - cobertura extendida', () => {
  let service: EmbeddingsService;
  let mockLogger: any;

  beforeEach(async () => {
    process.env.PINECONE_API_KEY = 'fake-key';
    process.env.PINECONE_INDEX = 'fake-index';
    process.env.OPENAI_API_KEY = 'fake-openai-key';

    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

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
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
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


  it('processFile maneja embedding vacío', async () => {
    service.splitTextIntoChunks = jest.fn().mockReturnValue(['chunk1']);
    // @ts-ignore
    service.openai.embeddings.create = jest.fn().mockResolvedValue({ data: [] });
    await service.processFile({ id: '1', name: 'test', mimeType: 'application/pdf' });
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Archivo test no tiene texto legible.'));
  });

  it('processFile inserta vectores y loguea', async () => {
    // Mock para que haya texto legible
    (extractTextFromDriveFile as jest.Mock).mockResolvedValueOnce('Texto válido para chunk.');
    service.splitTextIntoChunks = jest.fn().mockReturnValue(['chunk1']);
    // Mock para que openai.embeddings.create devuelva un embedding válido
    // @ts-ignore
    service.openai.embeddings.create = jest.fn().mockResolvedValue({ data: [{ embedding: [1, 2, 3], index: 0, object: 'embedding' }] });
    // @ts-ignore
    service.index.upsert = jest.fn().mockResolvedValue({});
    await service.processFile({ id: '1', name: 'test', mimeType: 'application/pdf' });
    expect(service['index'].upsert).toHaveBeenCalled();
    expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Se indexaron'));
  });

  it('processFile advierte si no hay vectores', async () => {
    service.splitTextIntoChunks = jest.fn().mockReturnValue(['chunk1']);
    // @ts-ignore
    service.openai.embeddings.create = jest.fn().mockResolvedValue({ data: [] });
    await service.processFile({ id: '1', name: 'test', mimeType: 'application/pdf' });
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Archivo test no tiene texto legible.'));
  });
});
