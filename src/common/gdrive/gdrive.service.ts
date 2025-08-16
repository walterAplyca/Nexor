import { Injectable } from '@nestjs/common';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDriveService } from './google-drive.helper';
import { DocumentContent } from '../interfaces/document.interface';
import { marked } from 'marked';
const htmlToDocx = require('html-to-docx');






@Injectable()
export class GdriveService {
    private drive;

    constructor() {
        this.initDrive();
    }

    private async initDrive() {
        this.drive = await getDriveService();
    }

    /**
     * Obtiene los archivos modificados en las últimas 24 horas de una carpeta específica.
     * @param folderId El ID de la carpeta de Google Drive.
     * @returns Una lista de archivos modificados en las últimas 24 horas.
     */
    async getModifiedFilesInLast24Hours(folderId: string) {
        if (!this.drive) {
            await this.initDrive(); // asegúrate que esté inicializado
        }
        const mimeTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/msword', // .doc
            'application/vnd.google-apps.document' // Google Docs nativo
        ];

        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        const mimeFilter = mimeTypes.map(m => `mimeType='${m}'`).join(' or ');

        // const query = `'${folderId}' in parents and (${mimeFilter}) and modifiedTime > '${last24h}' and trashed = false`;
        const query = `'${folderId}' in parents and (${mimeFilter}) and modifiedTime > '${last24h}' and trashed = false`;
        const res = await this.drive.files.list({
            q: query,
            fields: 'files(id, name, modifiedTime, mimeType)',
            supportsAllDrives: true,
        });

        const files = res.data.files || [];

        if (!files || files.length === 0) {

            return {
                message: 'No hay archivos modificados en las últimas 24 horas.',
                files: [],
            };
        }

        return {
            message: 'Archivos modificados en las últimas 24 horas encontrados.',
            files,
        };
    }

    /**
     * Crea y sube un documento a Google Drive.
     * @param content Contenido del documento a crear.
     * @returns Un objeto con el ID del archivo y el enlace para verlo en Google Drive.
     */
    async createAndUploadDocument(content: DocumentContent) {

        const { title, content: markdownContent } = content;
        // Convertir Markdown a HTML
        const htmlContent = marked(markdownContent);
        // Convertir HTML a DOCX
        const buffer = await htmlToDocx(htmlContent, {
            title,
            pageSize: 'A4',
            margins: { top: 720, right: 720, bottom: 720, left: 720 },
        });
        const tempFilePath = path.join(__dirname, `temp-${uuidv4()}.docx`);
        fs.writeFileSync(tempFilePath, buffer);

        const fileMetadata = {
            name: `${title}.docx`,
            mimeType: 'application/vnd.google-apps.document',
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        };

        const media = {
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            body: fs.createReadStream(tempFilePath),
        };

        const file = await this.drive.files.create({
            requestBody: fileMetadata,
            media,
            fields: 'id, webViewLink',
            supportsAllDrives: true,
        });

        // Borra el archivo temporal
        fs.unlinkSync(tempFilePath);

        return {
            fileId: file.data.id,
            link: file.data.webViewLink,
        };
    }



}
