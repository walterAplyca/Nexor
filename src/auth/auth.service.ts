import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from '../shared/security/constant';
import { User } from '../user/user/user';
import { UserService } from '../user/user.service';


@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UserService,
        private readonly jwtService: JwtService
    ) { }

    async validateUser(username: string, password: string): Promise<any> {
        const user: User | undefined = await this.usersService.findOne(username);



        if (user && user.password === password) {

            const { password, ...result } = user;
            return result;
        }
        return null;
    }

    async login(req: any) {
        const payload = { name: req.user.username, sub: req.user.id };
        return {
            token: this.jwtService.sign(payload, { privateKey: jwtConstants.JWT_SECRET }),
        };
    }

}