import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IndexationService } from './indexation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';


@Controller('indexation')
export class IndexationController {
    constructor(private readonly indexationService: IndexationService) { }

    @UseGuards(JwtAuthGuard)
    @Get('recent-files')
    async getRecentFiles(@Query('folderId') folderId: string) {
        if (!folderId) {
            return { error: 'El parámetro "folderId" es obligatorio' };
        }
        return this.indexationService.indexationDocuments(folderId);
    }
}
