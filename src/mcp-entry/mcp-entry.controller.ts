import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { BusinessLogicException } from '../common/errors/business-errors';
import { ToolsService } from './tools/tools.service';
import { Chat } from '../common/interfaces/chat.interface';



@Controller('mcp-entry')
export class McpEntryController {
    constructor(private readonly toolsService: ToolsService) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    @HttpCode(201)
    async handleTool(@Body() body: {
        tool_name: string;
        chat: Chat[];
        argumentos: any;
        typeFile: string;
    }) {
        const { tool_name, chat, argumentos, typeFile } = body;

        let data: any = null;
        let message = 'Tool executed successfully';
        let status = 'success';

        try {
            switch (tool_name) {
                case 'consult_document_existing':
                    data = await this.toolsService.consultDocument(chat, typeFile);
                    break;
                case 'draft_quotation':
                    data = await this.toolsService.generateReport(chat, typeFile);
                    break;
                case 'generate_quotation_file':
                    data = await this.toolsService.generateDocument(argumentos);
                    break;
                default:
                    throw new BusinessLogicException(`Tool ${tool_name} not recognized`, 400);
            }
        } catch (err) {
            throw new BusinessLogicException(err.message || 'Internal server error', 500);
        }

        return { status, message, data };
    }

    @Get('tools')
    getTools() {
        return this.toolsService.getAvailableTools();
    }

}
