import { Test, TestingModule } from '@nestjs/testing';
import { McpEntryController } from './mcp-entry.controller';
import { ToolsService } from './tools/tools.service';
import { BusinessLogicException } from '../common/errors/business-errors';
import { Chat } from '../common/interfaces/chat.interface';

describe('McpEntryController', () => {
  let controller: McpEntryController;
  let toolsService: jest.Mocked<ToolsService>;

  beforeEach(async () => {
    const mockToolsService = {
      consultDocument: jest.fn(),
      generateReport: jest.fn(),
      generateDocument: jest.fn(),
      getAvailableTools: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpEntryController],
      providers: [
        { provide: ToolsService, useValue: mockToolsService },
      ],
    }).compile();

    controller = module.get<McpEntryController>(McpEntryController);
    toolsService = module.get(ToolsService) as jest.Mocked<ToolsService>;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleTool', () => {
    const chat: Chat[] = [
      { role: 'user', content: 'Hola' },
      { role: 'assistant', content: 'Respuesta' },
    ];
    const argumentos = { title: 'Doc', generalDescription: '', tasks: [], activities: [], deliveryTime: '', notes: '' };

    it('ejecuta consult_document correctamente', async () => {
      toolsService.consultDocument.mockResolvedValue({
        message: 'Respuesta generada correctamente',
        data: 'ok',
        references: ['url1'],
      });
      const result = await controller.handleTool({ tool_name: 'consult_document', chat, argumentos });
      expect(toolsService.consultDocument).toHaveBeenCalledWith(chat);
      expect(result).toMatchObject({
        status: 'success',
        message: 'Tool executed successfully',
        data: {
          message: 'Respuesta generada correctamente',
          data: 'ok',
          references: ['url1'],
        },
      });
    });

    it('ejecuta generate_report correctamente', async () => {
      toolsService.generateReport.mockResolvedValue({
        message: 'Reporte generado correctamente',
        data: 'reporte',
        references: undefined,
      });
      const result = await controller.handleTool({ tool_name: 'generate_report', chat, argumentos });
      expect(toolsService.generateReport).toHaveBeenCalledWith(chat);
      expect(result.data).toEqual({
        message: 'Reporte generado correctamente',
        data: 'reporte',
        references: undefined,
      });
    });

    it('ejecuta generate_document correctamente', async () => {
      toolsService.generateDocument.mockResolvedValue({ fileId: 'id', link: 'url' });
      const result = await controller.handleTool({ tool_name: 'generate_document', chat, argumentos });
      expect(toolsService.generateDocument).toHaveBeenCalledWith(argumentos);
      expect(result.data).toEqual({ fileId: 'id', link: 'url' });
    });

    it('lanza error si la tool no existe', async () => {
      await expect(controller.handleTool({ tool_name: 'no_existe', chat, argumentos }))
        .rejects.toThrow(BusinessLogicException);
    });

    it('lanza error si el servicio lanza error', async () => {
      toolsService.consultDocument.mockRejectedValue(new Error('fail'));
      await expect(controller.handleTool({ tool_name: 'consult_document', chat, argumentos }))
        .rejects.toThrow(BusinessLogicException);
    });
  });

  describe('getTools', () => {
    it('retorna la lista de herramientas', () => {
      const tools = [
        {
          name: 'consult_document',
          description: 'Consulta información en documentos de Drive basado en un chat',
          parameters: {
            type: 'object',
            properties: {
              chat: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    role: {
                      type: 'string',
                      enum: ['system', 'user', 'assistant'],
                    },
                    content: {
                      type: 'string',
                    },
                  },
                  required: ['role', 'content'],
                },
              },
            },
            required: ['chat'],
          },
        },
        {
          name: 'generate_report',
          description: 'Genera un informe o reporte a partir de un chat tipo conversación',
          parameters: {
            type: 'object',
            properties: {
              chat: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    role: {
                      type: 'string',
                      enum: ['system', 'user', 'assistant'],
                    },
                    content: {
                      type: 'string',
                    },
                  },
                  required: ['role', 'content'],
                },
              },
            },
            required: ['chat'],
          },
        },
        {
          name: 'generate_document',
          description: 'Genera un documento en Google Drive a partir de una estructura con título, tareas, actividades, etc.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              generalDescription: { type: 'string' },
              tasks: {
                type: 'array',
                items: { type: 'string' },
              },
              activities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    hours: { type: 'number' },
                  },
                  required: ['title', 'hours'],
                },
              },
              deliveryTime: { type: 'string' },
              notes: { type: 'string' },
            },
            required: [
              'title',
              'generalDescription',
              'tasks',
              'activities',
              'deliveryTime',
              'notes',
            ],
          },
        },
      ];
      toolsService.getAvailableTools.mockReturnValue(tools);
      expect(controller.getTools()).toBe(tools);
      expect(toolsService.getAvailableTools).toHaveBeenCalled();
    });
  });
});
