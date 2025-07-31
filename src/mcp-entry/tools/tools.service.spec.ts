import { Test, TestingModule } from '@nestjs/testing';
import { ToolsService } from './tools.service';
import { EmbeddingsService } from '../../common/embeddings/embeddings.service';
import { GdriveService } from '../../common/gdrive/gdrive.service';
import { BusinessLogicException } from '../../common/errors/business-errors';
import { Chat } from '../../common/interfaces/chat.interface';
import { HttpStatus } from '@nestjs/common';

jest.mock('../../common/embeddings/embeddings.service');
jest.mock('../../common/gdrive/gdrive.service');

describe('ToolsService', () => {
  let service: ToolsService;
  let embeddingsService: jest.Mocked<EmbeddingsService>;
  let gdriveService: jest.Mocked<GdriveService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolsService,
        EmbeddingsService,
        GdriveService,
      ],
    }).compile();

    service = module.get<ToolsService>(ToolsService);
    embeddingsService = module.get(EmbeddingsService) as jest.Mocked<EmbeddingsService>;
    gdriveService = module.get(GdriveService) as jest.Mocked<GdriveService>;

    // @ts-ignore
    service['embeddingsService'] = embeddingsService;
    // @ts-ignore
    service['drive'] = gdriveService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('consultDocument', () => {
    it('debe retornar respuesta generada correctamente', async () => {
      const messages: Chat[] = [
        { role: 'user', content: 'Cotización' },
        { role: 'assistant', content: 'Aquí está...' },
      ];
      const contextObj = { context: 'contexto relevante', urls: ['url1'] };
      const cleanedHistory = [{ role: 'user', content: '¿Qué es IA?' }];
      jest.spyOn<any, any>(service, 'prepareContext').mockResolvedValue({ cleanedHistory, context: contextObj });
      embeddingsService.chat.mockResolvedValue('respuesta modelo');

      const result = await service.consultDocument(messages);

      expect(result).toEqual({
        message: 'Respuesta generada correctamente',
        data: 'respuesta modelo',
        references: ['url1'],
      });
    });

    it('debe lanzar BusinessLogicException si ocurre error', async () => {
      jest.spyOn<any, any>(service, 'prepareContext').mockRejectedValue(new Error('fail'));
      await expect(service.consultDocument([])).rejects.toThrow(BusinessLogicException);
    });
  });

  describe('generateReport', () => {
    it('debe retornar respuesta generada correctamente', async () => {
      const messages: Chat[] = [
        { role: 'user', content: 'Cotización' },
        { role: 'assistant', content: 'Aquí está...' },
      ];
      const contextObj = { context: 'contexto relevante', urls: [] };
      const cleanedHistory = [{ role: 'user', content: 'Cotización' }];
      jest.spyOn<any, any>(service, 'prepareContext').mockResolvedValue({ cleanedHistory, context: contextObj });
      embeddingsService.chat.mockResolvedValue('reporte generado');

      const result = await service.generateReport(messages);

      expect(result).toEqual({
        message: 'Respuesta generada correctamente',
        data: 'reporte generado',
        references: undefined,
      });
    });

    it('debe lanzar BusinessLogicException si ocurre error', async () => {
      jest.spyOn<any, any>(service, 'prepareContext').mockRejectedValue(new Error('fail'));
      await expect(service.generateReport([])).rejects.toThrow(BusinessLogicException);
    });
  });

  describe('generateDocument', () => {
    it('debe retornar el resultado de createAndUploadDocument', async () => {
      const docContent = { title: 'Doc', generalDescription: '', tasks: [], activities: [], deliveryTime: '', notes: '' };
      gdriveService.createAndUploadDocument.mockResolvedValue({ fileId: 'id', link: 'url' });

      const result = await service.generateDocument(docContent as any);

      expect(result).toEqual({ fileId: 'id', link: 'url' });
      expect(gdriveService.createAndUploadDocument).toHaveBeenCalledWith(docContent);
    });

    it('debe lanzar BusinessLogicException si ocurre error', async () => {
      gdriveService.createAndUploadDocument.mockRejectedValue(new Error('fail'));
      await expect(service.generateDocument({} as any)).rejects.toThrow(BusinessLogicException);
    });
  });

  describe('getAvailableTools', () => {
    it('debe retornar la lista de herramientas', () => {
      const tools = service.getAvailableTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.map(t => t.name)).toEqual(
        expect.arrayContaining(['consult_document', 'generate_report', 'generate_document'])
      );
    });
  });

  describe('private methods', () => {
    it('getLastUserMessage retorna el último mensaje de usuario', () => {
      const messages = [
        { role: 'assistant', content: 'Hola' },
        { role: 'user', content: '¿Qué es IA?' },
        { role: 'assistant', content: 'La IA es...' },
      ];
      // @ts-ignore
      const result = service.getLastUserMessage(messages);
      expect(result).toEqual({ role: 'user', content: '¿Qué es IA?' });
    });

    it('getLastUserMessage retorna null si no hay mensajes de usuario', () => {
      const messages = [
        { role: 'assistant', content: 'Hola' },
        { role: 'system', content: 'Sistema' },
      ];
      // @ts-ignore
      const result = service.getLastUserMessage(messages);
      expect(result).toBeNull();
    });

    it('prepareContext y getChunkChat funcionan correctamente', async () => {
      // Mocks para prepareContext y getChunkChat
      const messages = [
        { role: 'user', content: 'Hola' },
        { role: 'assistant', content: 'Respuesta' },
      ];
      embeddingsService.getTypeFileDocument.mockResolvedValue('cotizacion');
      jest.spyOn<any, any>(service, 'getChunkChat').mockResolvedValue({ context: 'ctx', urls: ['url1'] });

      // @ts-ignore
      const result = await service['prepareContext'](messages, 3);
      expect(result.cleanedHistory).toBeDefined();
      expect(result.typeFile).toBe('cotizacion');
      expect(result.context).toEqual({ context: 'ctx', urls: ['url1'] });
    });

    it('getChunkChat retorna contexto y urls', async () => {
      const messages = [
        { role: 'user', content: 'Hola' },
        { role: 'assistant', content: 'Respuesta' },
      ];
      embeddingsService.createEmbedding.mockResolvedValue({ data: [{ embedding: [1, 2, 3] }] });
      embeddingsService.querySimilarChunks.mockResolvedValue([
        { id: '1', score: 0.9, metadata: { text: 'Texto1', url: 'url1' } },
        { id: '2', score: 0.8, metadata: { text: 'Texto2', url: 'url2' } },
      ]);

      // @ts-ignore
      const result = await service['getChunkChat'](messages, 'cotizacion', 2);
      expect(result.context).toContain('Texto1');
      expect(result.context).toContain('Texto2');
      expect(result.urls).toEqual(['url1', 'url2']);
    });
  });
});
