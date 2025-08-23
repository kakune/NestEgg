"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('config', () => ({
    database: {
        url: process.env.DATABASE_URL ||
            'postgresql://user:password@localhost:5432/nestegg?schema=public',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'your-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    app: {
        port: parseInt(process.env.PORT || '3000', 10),
        environment: process.env.NODE_ENV || 'development',
    },
    security: {
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        prettyPrint: process.env.NODE_ENV === 'development',
    },
}));
//# sourceMappingURL=configuration.js.map