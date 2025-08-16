import { Injectable } from '@nestjs/common';
import { User } from './user/user';
import { JwtService } from '@nestjs/jwt';


@Injectable()
export class UserService {

    constructor(private readonly jwtService: JwtService) { }

    private readonly username = process.env.NAMEUSER ? process.env.NAMEUSER : 'defaultUser';
    private readonly password = process.env.PASSWORD ? process.env.PASSWORD : 'defaultPass';
    private readonly role = process.env.ROLE ? process.env.ROLE : 'user';

    private readonly users: User[] = [
        new User(1, this.username, this.password, [this.role]),
    ];

    async findOne(username: string): Promise<User | undefined> {
        return this.users.find(user => user.username === username);
    }
}