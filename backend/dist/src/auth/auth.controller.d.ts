import { AuthService, AuthResponse } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CreatePersonalAccessTokenDto } from './dto/create-personal-access-token.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<AuthResponse>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    logout(sessionId: string): Promise<void>;
    getProfile(req: {
        user: {
            userId: string;
            email: string;
            householdId: string;
            role: string;
        };
    }): {
        user: {
            id: string;
            email: string;
            householdId: string;
            role: string;
        };
    };
    createPersonalAccessToken(userId: string, createPatDto: CreatePersonalAccessTokenDto): Promise<{
        token: string;
        id: string;
    }>;
    revokePersonalAccessToken(userId: string, tokenId: string): Promise<void>;
}
