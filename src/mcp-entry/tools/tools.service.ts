import { Injectable, HttpStatus, } from '@nestjs/common';
import { EmbeddingsService } from '../../common/embeddings/embeddings.service';
import { truncateMessages } from './utils/truncate';
import { Chat } from '../../common/interfaces/chat.interface';
import { BusinessLogicException } from '../../common/errors/business-errors';
import { DocumentContent } from '../../common/interfaces/document.interface';
import { GdriveService } from '../../common/gdrive/gdrive.service';



@Injectable()
export class ToolsService {

    private readonly drive = new GdriveService();

    constructor(
        private readonly embeddingsService: EmbeddingsService,


    ) { }


    /**
     * Consulta un documento basado en el historial de chat y el contexto relevante.
     * @param messages - Historial de mensajes del chat.
     * @returns Un objeto con el mensaje de éxito y los datos generados por el modelo.
     */
    async consultDocument(messages: Chat[], typeFile: string = 'incidencia') {

        try {
            const { cleanedHistory, context } = await this.prepareContext(messages, 4, typeFile);
            const prompt: Chat[] = [
                ...cleanedHistory,
                { role: 'system', content: `Contexto relevante:\n\n${context.context}` },
                { role: 'system', content: `Redacte un resumen ejecutivo de la información consultada` }
            ];
            console.log('Prompt:', prompt);
            console.log('Context:', context);
            return {
                message: 'Respuesta generada correctamente',
                data: await this.embeddingsService.chat(prompt, 0.7),
                references: context.urls.length > 0 ? context.urls : undefined,
            };
        } catch (error) {
            throw new BusinessLogicException(error, HttpStatus.INTERNAL_SERVER_ERROR)
        }
    }

    /**
     * Genera un reporte basado en el historial de chat y el contexto relevante.
     * @param messages - Historial de mensajes del chat.
     * @returns Un objeto con el mensaje de éxito y el reporte generado por el modelo.
    **/

    async generateReport(messages: Chat[], typeFile: string = 'reporte_horas') {
        try {
            const { cleanedHistory, context } = await this.prepareContext(messages, 5, typeFile);
            const prompt: Chat[] = [
                ...cleanedHistory,
                { role: 'system', content: `Contexto relevante:\n\n${context.context}` },
                { role: 'system', content: `Tenga en cuenta los requerimientos que se encuentran en el contexto y Redacta una cotización con estructura clara:\n- Título\n- Tabla con Producto, Precio, Marca\n- Comentario final` }
            ];

            return {
                message: 'Respuesta generada correctamente',
                data: await this.embeddingsService.chat(prompt, 0.7),
                references: context.urls.length > 0 ? context.urls : undefined,
            };
        } catch (error) {
            throw new BusinessLogicException(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Genera un documento y lo sube a Google Drive.
     * @param arg - Contenido del documento a generar.
     * @returns Un objeto con el mensaje de éxito y el documento creado.
     */
    async generateDocument(arg: DocumentContent) {
        try {
            return await this.drive.createAndUploadDocument(arg)
        } catch (error) {
            throw new BusinessLogicException(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


    private toolFormat(nameTool: string, description: string) {
        return {
            name: nameTool,
            description: description,
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
                    typeFile: {
                        type: 'string',
                        description: 'Tipo de archivo del documento consultado, por ejemplo: "incidencia", "reporte_horas", "cotizacion"',
                        enum: ['incidencia', 'reporte_horas', 'cotizacion'],
                    },
                },
                required: ['chat', 'typeFile'],
            },
        };
    }

    getAvailableTools() {
        return [
            this.toolFormat('consult_document', 'Consulta un documento basado en el historial de chat y el contexto relevante'),
            this.toolFormat('generate_report', 'Genera un reporte basado en el historial de chat y el contexto relevante'),
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
    }


    /**
     * Prepara el historial de mensajes, obtiene el tipo de archivo y el contexto relevante.
     * @param messages - Historial de mensajes del chat.
     * @returns Un objeto con cleanedHistory, typeFile y context.
     */
    private async prepareContext(messages: Chat[], topK: number = 5, typeFile: string = 'incidencia') {
        const cleanedHistory = truncateMessages(messages);
        console.log('Type File:', typeFile);
        const context = await this.getChunkChat(messages, typeFile, topK);
        return { cleanedHistory, typeFile, context };
    }


    private async getChunkChat(messages: Chat[], typeFile: string, topK: number = 5) {
        const lastUserMessage = this.getLastUserMessage(messages);
        const embedding = await this.embeddingsService.createEmbedding(lastUserMessage?.content ?? '');
        const embeddingRes = embedding.data[0].embedding;
        const chunks = await this.embeddingsService.querySimilarChunks(embeddingRes, typeFile, topK);
        const context = chunks.map(c => c.metadata?.text).join('\n\n');
        console.log('Context in Chunks:', context);
        const urls = chunks
            .map(c => c.metadata?.url) // <- Asegúrate de que sea `.url` (no `.urls`)
            .filter((url): url is string => typeof url === 'string'); // Solo strings válidos

        return {
            context,
            urls
        };
    }

    private getLastUserMessage(messages: Chat[]): Chat | null {
        const reversed = [...messages].reverse();
        return reversed.find(m => m.role === 'user') ?? null;
    }
}
