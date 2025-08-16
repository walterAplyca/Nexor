import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtModule } from '@nestjs/jwt';
import { UserController } from './user.controller';
import { AuthService } from 'src/auth/auth.service';

@Module({
  imports: [
    JwtModule.register({}) // Puedes dejarlo vacío si solo usas inyección, la configuración principal está en AuthModule
  ],
  providers: [UserService, JwtModule, AuthService],
  controllers: [UserController],
})
export class UserModule {

}
