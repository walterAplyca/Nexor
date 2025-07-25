import { Body, Controller, Post } from '@nestjs/common';
import { ToolsService } from './tools/tools.service';
import { Chat } from '../common/interfaces/chat.interface';


@Controller('mcp-entry')
export class McpEntryController {
    constructor(private readonly toolsService: ToolsService) { }

    @Post()
    async handleTool(@Body() body: {
        tool_name: string;
        chat: Chat[];
        argumentos: any;
    }) {
        const { tool_name, chat, argumentos } = body;

        let data: any = null;
        let message = 'Tool executed successfully';
        let status = 'success';

        try {
            switch (tool_name) {
                case 'consult_document':
                    data = await this.toolsService.consultDocument(chat);
                    break;
                case 'generate_report':
                    data = await this.toolsService.generateReport(chat);
                    break;
                case 'generate_document':
                    data = await this.toolsService.generateDocument(argumentos);
                    break;
                default:
                    status = 'error';
                    message = 'Tool not recognized';
            }
        } catch (err) {
            status = 'error';
            message = err.message || 'Internal server error';
        }

        return { status, message, data };
    }


}
