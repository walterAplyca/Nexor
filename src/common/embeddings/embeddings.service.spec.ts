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
