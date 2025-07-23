
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { getDriveService } from '../../gdrive/google-drive.helper';




export async function extractTextFromDriveFile(fileId: string, mimeType: string): Promise<string | null> {
    const drive = await getDriveService();
    try {
        // Paso 1: Obtener el contenido binario del archivo desde Google Drive
        console.log(`Extrayendo texto del archivo con ID: ${fileId}, tipo MIME: ${mimeType}`);
        const res = await drive.files.get(
            {
                fileId,
                alt: 'media',
            },
            { responseType: 'arraybuffer' }
        );

        const buffer = Buffer.from(res.data as ArrayBuffer);

        // Paso 2: Procesar según el tipo de archivo
        if (mimeType === 'application/pdf') {
            const data = await pdfParse(buffer);
            return data.text;
        }

        if (
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // .docx
            mimeType === 'application/msword' // .doc
        ) {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        }

        console.warn(`Tipo de archivo no soportado: ${mimeType}`);
        return null;
    } catch (error) {
        console.error('Error extrayendo texto del archivo:', error);
        return null;
    }
}