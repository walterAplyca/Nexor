import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessLogicException extends HttpException {
    constructor(message: string, status: HttpStatus) {
        super(message, status);
    }
}