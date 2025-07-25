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
    async consultDocument(messages: Chat[]) {

        try {
            const context = await this.getChunkChat(messages);
            const cleanedHistory = truncateMessages(messages);
            const prompt: Chat[] = [
                ...cleanedHistory,
                { role: 'system', content: `Contexto relevante:\n\n${context}` },
                { role: 'system', content: `Redacta una cotización con estructura clara:\n- Título\n - Un texto descriptivo de todos las actividades a realizar\n- Tabla con Producto, Precio, Marca\n- Un texto donde se defina el tiempo de entrega en número de días habiles` }
            ];
            return {
                message: 'Respuesta generada correctamente',
                data: await this.embeddingsService.chat(prompt),
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

    async generateReport(messages: Chat[]) {
        try {
            const context = await this.getChunkChat(messages);
            const cleanedHistory = truncateMessages(messages);
            const prompt: Chat[] = [
                ...cleanedHistory,
                { role: 'system', content: `Contexto relevante:\n\n${context}` },
                { role: 'system', content: `Redacta una cotización con estructura clara:\n- Título\n- Tabla con Producto, Precio, Marca\n- Comentario final` }
            ];

            return {
                message: 'Respuesta generada correctamente',
                data: await this.embeddingsService.chat(prompt),
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


    private async getChunkChat(messages: Chat[]) {
        const lastUserMessage = this.getLastUserMessage(messages);
        const embedding = await this.embeddingsService.createEmbedding(lastUserMessage?.content ?? '');
        const chunks = await this.embeddingsService.querySimilarChunks(embedding, 5);
        const context = chunks.map(c => c.metadata?.text).join('\n\n');
        return context;
    }

    private getLastUserMessage(messages: Chat[]): Chat | null {
        const reversed = [...messages].reverse();
        return reversed.find(m => m.role === 'user') ?? null;
    }
}
