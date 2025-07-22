import { Injectable } from '@nestjs/common';
import { getDriveService } from './google-drive.helper';


@Injectable()
export class GdriveService {
    private drive;

    constructor() {
        this.initDrive();
    }

    private async initDrive() {
        this.drive = await getDriveService();
    }

    async getModifiedFilesInLast24Hours(folderId: string) {
        if (!this.drive) {
            await this.initDrive(); // asegúrate que esté inicializado
        }
        const mimeTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/msword' // .doc
        ];

        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        const mimeFilter = mimeTypes.map(m => `mimeType='${m}'`).join(' or ');

        const query = `'${folderId}' in parents and (${mimeFilter}) and modifiedTime > '${last24h}' and trashed = false`;

        const res = await this.drive.files.list({
            q: query,
            fields: 'files(id, name, modifiedTime, mimeType)',
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

}
