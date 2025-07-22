import { Controller, Get, Query } from '@nestjs/common';
import { IndexationService } from './indexation.service';

@Controller('indexation')
export class IndexationController {
    constructor(private readonly indexationService: IndexationService) { }

    @Get('recent-files')
    async getRecentFiles(@Query('folderId') folderId: string) {
        if (!folderId) {
            return { error: 'El parámetro "folderId" es obligatorio' };
        }
        return this.indexationService.indexationDocuments(folderId);
    }
}
