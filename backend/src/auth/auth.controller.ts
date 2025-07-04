import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('google')
    async loginGoogle(@Body('token') token: string) {
        return this.authService.loginWithGoogle(token);
    }
}