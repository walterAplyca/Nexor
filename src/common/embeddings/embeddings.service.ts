import { Injectable, Logger } from '@nestjs/common';
import { drive_v3 } from 'googleapis';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { GdriveService } from '../gdrive/gdrive.service';
import { extractTextFromDriveFile } from './utils/extract-text.util';

/** Nuevo Lanchaing */
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from "@langchain/pinecone";
import { Document } from 'langchain/document';

/** Nuevo Lanchaing */



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
    private readonly indexName = process.env.PINECONE_INDEX || 'default';
    private readonly openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    private readonly logger = new Logger(EmbeddingsService.name);

    /** Nuevo Lanchaing */
    private readonly splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
    });

    private readonly embedding = new OpenAIEmbeddings({
        modelName: 'text-embedding-3-small',
        openAIApiKey: process.env.OPENAI_API_KEY,
    });
    /** Nuevo Lanchaing */



    constructor() { }

    async indexByFileId(fileId: string) {
        try {
            const response_drive = await this.drive.getModifiedFilesInLast24Hours(fileId);

            if (response_drive.files.length === 0) {
                return response_drive;
            }

            for (const file of response_drive.files) {
                await this.processFile(file);
            }


        } catch (error) {
            console.error('Error obteniendo metadatos del archivo:', error);
            throw error;
        }
    }


    async processFile(file: drive_v3.Schema$File) {
        const text = await extractTextFromDriveFile(file.id!, file.mimeType!);
        if (!text) {
            this.logger.warn(`Archivo ${file.name} no tiene texto legible.`);
            return;
        }
        const typeFile = await this.getTypeFileDocument(text);
        const chunks = await this.splitIntoChunks(text, {
            fileId: file.id!,
            fileName: file.name!,
            mimeType: file.mimeType!,
            url: `https://drive.google.com/file/d/${file.id}/view`,
            sourceType: 'google_drive',
            typeFile: typeFile,
            createdAt: new Date().toISOString(),
        });

        if (chunks.length === 0) {
            this.logger.warn(`Archivo ${file.name} no tiene texto legible después de dividir.`);
            return;
        }

        return await this.storeInPinecone(chunks);
    }

    public async createEmbedding(chunk: string): Promise<any> {
        return this.openai.embeddings.create({
            input: chunk,
            model: process.env.MODEL_EMBEDDINGS || 'text-embedding-3-small',
        });
    }


    async querySimilarChunks(
        query: string,
        typeFile?: string, // Por ejemplo: 'cotizacion' | 'reporte' | 'incidencia'
        k: number = 4,
        group: boolean = false,
    ) {
        const index = this.pinecone.Index(this.indexName);
        const vectorStore = await PineconeStore.fromExistingIndex(
            this.embedding,
            { pineconeIndex: index, namespace: 'default' },
        );
        const filter = typeFile
            ? { typeFile: typeFile }
            : undefined;
        const results = await (vectorStore as any).similaritySearch(query, k, filter);

        if (!group) return results;


        type ChunkDoc = {
            pageContent: string;
            metadata: {
                fileId: string;
                chunkIndex?: number;
                [key: string]: any;
            };
            score?: number;
        };


        // Agrupa por fileId
        const groupedByFileId: Record<string, ChunkDoc[]> = results.reduce((acc, doc) => {
            const fileId = doc.metadata?.fileId;
            if (!fileId) return acc;
            if (!acc[fileId]) acc[fileId] = [];
            acc[fileId].push(doc);
            return acc;
        }, {} as Record<string, ChunkDoc[]>);


        // Selecciona el grupo con mayor relevancia (por score si está disponible)
        const bestGroup = Object.values(groupedByFileId).sort((a, b) => {
            const scoreA = a.reduce((sum, doc) => sum + (doc.score ?? 0), 0);
            const scoreB = b.reduce((sum, doc) => sum + (doc.score ?? 0), 0);
            return scoreB - scoreA;
        })[0];

        return bestGroup;
    }


    public async chat(prompt: Array<{ role: 'system' | 'user' | 'assistant', content: string }>, temperature: number = 0.7): Promise<any> {
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4',
            messages: prompt,
            temperature
        });

        return response.choices[0].message;
    }

    async getTypeFileDocument(content: string): Promise<string> {
        const prompt = `
                Analiza el siguiente texto extraído de un documento y determina cuál de los siguientes tipos representa mejor su contenido:

                1. Informe de incidencia
                2. Reporte de horas
                3. Cotización
        
                Texto del documento:
                ---
                ${content.slice(0, 2000)}
                ---

                Responde únicamente con una de las siguientes palabras en minúsculas: "incidencia", "reporte_horas", "cotizacion", "otro".
                `


        const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [
            { role: 'system', content: 'Eres un clasificador inteligente de documentos' },
            { role: 'user', content: prompt }
        ];
        const respuesta = await this.chat(messages, 0);
        return respuesta.content.trim() as 'incidencia' | 'reporte_horas' | 'cotizacion';

    }

    /** Nuevo Lanchaing */
    async splitIntoChunks(text: string, metadata: Record<string, any>) {
        const chunks = await this.splitter.createDocuments([text], [metadata]);

        const enrichedChunks = chunks.map(chunk => {
            return new Document({
                pageContent: chunk.pageContent,
                metadata: {
                    ...chunk.metadata,
                    chunk: chunk.pageContent, // Agrega el texto del chunk a la metadata
                },
            });
        });

        return enrichedChunks;
    }

    async storeInPinecone(
        chunks: Document[],
        indexName: string = this.indexName,
    ) {
        const index = this.pinecone.Index(indexName);
        await PineconeStore.fromDocuments(chunks, this.embedding, {
            pineconeIndex: index,
            namespace: 'default',
        });
        return { message: 'Chunks almacenados correctamente.' };
    }

    /** Nuevo Lanchaing */


}
