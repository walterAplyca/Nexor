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
            const { cleanedHistory, context } = await this.prepareContext(messages, 6, typeFile, true);
            const prompt: Chat[] = [
                ...cleanedHistory,
                { role: 'system', content: `Contexto relevante:\n\n${context.context}` },
                { role: 'system', content: `Redacte un resumen ejecutivo de la información consultada` }
            ];
            return {
                message: 'Respuesta generada correctamente',
                data: await this.embeddingsService.chat(prompt, 0.7),
                references: context.files.length > 0 ? context.files : undefined,
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

    async generateReport(messages: Chat[], typeFile: string = 'cotización') {
        try {
            const { cleanedHistory, context } = await this.prepareContext(messages, 5, typeFile, false);
            const prompt: Chat[] = [
                ...cleanedHistory,
                { role: 'system', content: `Contexto relevante:\n\n${context.context}` },
                { role: 'system', content: `Tenga en cuenta los requerimientos que se encuentran en el contexto y Redacta una cotización en formato markdown con estructura clara:\n- Título\n - Texto descriptivo de cada una de las tareas a realizar\n- Tabla con Producto, Número de horas\n- Comentario final` }
            ];

            return {
                message: 'Respuesta generada correctamente',
                data: await this.embeddingsService.chat(prompt, 0.5),
                references: context.files.length > 0 ? context.files : undefined,
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


    private toolFormat(nameTool: string, title: string, description: string) {
        return {
            name: nameTool,
            title: title,
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
            this.toolFormat('consult_document_existing', '', 'Consulta un documento basado en el historial de chat y el contexto relevante'),
            this.toolFormat('draft_quotation', 'Redactar cotización preliminar', 'Genera un texto en formato Markdown con la estructura de una cotización, basado en el historial del chat donde el usuario describe requerimientos, necesidades o servicios esperados. No guarda archivos ni consulta documentos previos.'),
            {
                name: 'generate_quotation_file',
                title: 'Generar cotización en Word desde texto',
                description: "Recibe un texto en formato Markdown que representa una cotización con la siguiente estructura: título, lista de tareas, tabla de actividades (Producto, Precio, Marca) y comentario final. Convierte esa información en una estructura JSON detallada con título, descripción, tareas, actividades, tiempo de entrega y notas, y genera un archivo Word profesional que se guarda automáticamente en Google Drive.",
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
    private async prepareContext(messages: Chat[], topK: number = 5, typeFile: string = 'incidencia', group: boolean = false) {
        const cleanedHistory = truncateMessages(messages);
        const context = await this.getChunkChat(messages, typeFile, topK, group);
        return { cleanedHistory, typeFile, context };
    }


    private async getChunkChat(messages: Chat[], typeFile: string, topK: number = 5, group: boolean = false) {
        const lastUserMessage = this.getLastUserMessage(messages);
        const chunks = await this.embeddingsService.querySimilarChunks(lastUserMessage?.content ?? '', typeFile, topK, group);
        const context = chunks.map(c => c.metadata?.chunk).join('\n\n');
        const files = chunks
            .map(c => {
                const fileName = c.metadata?.fileName;
                const url = c.metadata?.url;

                if (typeof fileName === 'string' && typeof url === 'string') {
                    return { fileName, url };
                }

                return null;
            })
            .filter((item): item is { fileName: string; url: string } => item !== null);

        return {
            context,
            files
        };
    }

    private getLastUserMessage(messages: Chat[]): Chat | null {
        const reversed = [...messages].reverse();
        return reversed.find(m => m.role === 'user') ?? null;
    }
}
