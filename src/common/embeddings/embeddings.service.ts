import { Injectable, Logger } from '@nestjs/common';
import { drive_v3 } from 'googleapis';
import OpenAI from 'openai';
import { Pinecone, PineconeRecord } from '@pinecone-database/pinecone';
import { GdriveService } from '../gdrive/gdrive.service';
import { extractTextFromDriveFile } from './utils/extract-text.util';




@Injectable()
export class EmbeddingsService {

    private readonly drive = new GdriveService();
    private readonly pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY ?? (() => {
            throw new Error('PINECONE_API_KEY env var is not set');
        })(),
    });
    private readonly index = this.pinecone.Index(process.env.PINECONE_INDEX ?? (() => {
        throw new Error('PINECONE_INDEX env var is not set');
    })());
    private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    private readonly logger = new Logger(EmbeddingsService.name);

    constructor() { }

    async indexByFileId(fileId: string) {
        try {
            const response_drive = await this.drive.getModifiedFilesInLast24Hours(fileId);

            if (response_drive.files.length === 0) {
                return response_drive;
            }

            for (const file of response_drive.files) {
                console.log(file);
                await this.processFile(file);


            }

        } catch (error) {
            console.error('Error obteniendo metadatos del archivo:', error);
            throw error;
        }
    }


    async processFile(file: drive_v3.Schema$File): Promise<void> {
        const text = await extractTextFromDriveFile(file.id!, file.mimeType!);
        if (!text) {
            this.logger.warn(`Archivo ${file.name} no tiene texto legible.`);
            return;
        }

        // Dividir el texto en fragmentos si es necesario
        const chunks = this.splitTextIntoChunks(text, 1000);
        if (chunks.length === 0) {
            this.logger.warn(`Archivo ${file.name} no tiene texto legible después de dividir.`);
            return;
        }

        const vectors: PineconeRecord<Record<string, string | number | boolean>>[] = [];
        // Procesar cada fragmento de texto
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]?.trim();
            if (!chunk) continue;
            const chunkId = `${file.id!}-chunk-${i}`;

            try {
                const embeddingRes = await this.openai.embeddings.create({
                    input: chunk,
                    model: process.env.MODEL_EMBEDDINGS || 'text-embedding-3-small',
                });

                if (!embeddingRes.data.length || !embeddingRes.data[0]?.embedding) {
                    this.logger.warn(`No se pudo generar embedding para chunk ${chunkId}`);
                    continue;
                }
                const embedding = embeddingRes.data[0].embedding;
                vectors.push({
                    id: chunkId,
                    values: embedding,
                    metadata: {
                        fileId: file.id!,
                        fileName: file.name!,
                        chunkIndex: i,
                        text: chunk,
                        mimeType: file.mimeType!,
                        createdAt: new Date().toISOString(),
                        url: `https://drive.google.com/file/d/${file.id}/view`,
                        sourceType: 'google_drive',
                    },
                });
                this.logger.log(`Embeddings generados para ${file.name}`);
            } catch (error) {
                this.logger.error(`Error al procesar chunk ${chunkId}: ${error.message}`);
            }
        }

        // Batch insert all vectors
        if (vectors.length > 0) {
            try {
                await this.index.upsert(vectors);
                this.logger.log(`Se indexaron ${vectors.length} embeddings para ${file.name}`);
            } catch (err) {
                this.logger.error(`Error al insertar en Pinecone: ${err.message}`);
            }
        } else {
            this.logger.warn(`No se insertaron vectores para ${file.name}`);
        }

    }


    /**
     * Divide un texto largo en fragmentos (chunks) de tamaño máximo especificado.
     * 
     * El texto se separa primero por párrafos. Si un párrafo es demasiado largo,
     * se divide en oraciones para asegurar que ningún fragmento supere el límite.
     * Esto es útil para procesar textos extensos en partes manejables, por ejemplo,
     * al generar embeddings o enviar datos a APIs con límites de tamaño.
     * 
     * @param text Texto completo a dividir.
     * @param maxChunkLength Longitud máxima permitida para cada fragmento (por defecto 1000 caracteres).
     * @returns Un arreglo de fragmentos de texto.
     */
    splitTextIntoChunks(text: string, maxChunkLength: number = 1000): string[] {
        const paragraphs = text.split(/\n\s*\n/);
        const chunks: string[] = [];
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            const trimmed = paragraph.trim();
            if (!trimmed) continue;

            if (this.canAddToChunk(currentChunk, trimmed, maxChunkLength)) {
                currentChunk = this.addToChunk(currentChunk, trimmed);
            } else {
                if (currentChunk) chunks.push(currentChunk.trim());
                this.processParagraph(trimmed, maxChunkLength, chunks);
                currentChunk = '';
            }
        }

        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks;
    }

    /**
     * Verifica si se puede agregar un texto al fragmento actual sin exceder el tamaño máximo.
     * 
     * @param currentChunk Fragmento actual.
     * @param text Texto a agregar.
     * @param maxChunkLength Longitud máxima permitida.
     * @returns true si se puede agregar, false si excede el límite.
     */
    private canAddToChunk(currentChunk: string, text: string, maxChunkLength: number): boolean {
        return (currentChunk + '\n' + text).length <= maxChunkLength;
    }

    /**
     * Agrega un texto al fragmento actual, separando por salto de línea si es necesario.
     * 
     * @param currentChunk Fragmento actual.
     * @param text Texto a agregar.
     * @returns El fragmento actualizado.
     */
    private addToChunk(currentChunk: string, text: string): string {
        return currentChunk ? currentChunk + '\n' + text : text;
    }

    /**
     * Procesa un párrafo: si es demasiado largo, lo divide en oraciones;
     * si no, lo agrega directamente a los fragmentos.
     * 
     * @param paragraph Párrafo a procesar.
     * @param maxChunkLength Longitud máxima permitida.
     * @param chunks Arreglo donde se agregan los fragmentos resultantes.
     */
    private processParagraph(paragraph: string, maxChunkLength: number, chunks: string[]): void {
        if (paragraph.length > maxChunkLength) {
            this.splitLongParagraph(paragraph, maxChunkLength, chunks);
        } else {
            chunks.push(paragraph);
        }
    }

    /**
     * Divide un párrafo muy largo en fragmentos más pequeños usando oraciones,
     * asegurando que cada fragmento no exceda el tamaño máximo.
     * 
     * @param paragraph Párrafo largo a dividir.
     * @param maxChunkLength Longitud máxima permitida.
     * @param chunks Arreglo donde se agregan los fragmentos resultantes.
     */
    private splitLongParagraph(paragraph: string, maxChunkLength: number, chunks: string[]): void {
        const sentences = paragraph.split(/(?<=[.?!])\s+/);
        let sentenceChunk = '';

        for (const sentence of sentences) {
            if ((sentenceChunk + ' ' + sentence).trim().length <= maxChunkLength) {
                sentenceChunk = sentenceChunk ? sentenceChunk + ' ' + sentence : sentence;
            } else {
                if (sentenceChunk) chunks.push(sentenceChunk.trim());
                sentenceChunk = sentence;
            }
        }

        if (sentenceChunk) chunks.push(sentenceChunk.trim());
    }






}
