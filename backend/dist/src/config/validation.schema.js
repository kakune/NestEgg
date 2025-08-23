"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationSchema = void 0;
const Joi = __importStar(require("joi"));
exports.validationSchema = Joi.object({
    DATABASE_URL: Joi.string()
        .required()
        .description('PostgreSQL connection URL'),
    JWT_SECRET: Joi.string()
        .min(32)
        .required()
        .description('JWT secret key (min 32 chars)'),
    JWT_EXPIRES_IN: Joi.string().default('7d').description('JWT expiration time'),
    PORT: Joi.number().port().default(3000).description('Application port'),
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development')
        .description('Application environment'),
    BCRYPT_ROUNDS: Joi.number()
        .integer()
        .min(10)
        .max(15)
        .default(12)
        .description('BCrypt rounds'),
    CORS_ORIGIN: Joi.string()
        .uri()
        .default('http://localhost:5173')
        .description('CORS allowed origin'),
    RATE_LIMIT_TTL: Joi.number()
        .integer()
        .positive()
        .default(60)
        .description('Rate limit TTL in seconds'),
    RATE_LIMIT_MAX: Joi.number()
        .integer()
        .positive()
        .default(100)
        .description('Max requests per TTL'),
    LOG_LEVEL: Joi.string()
        .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
        .default('info')
        .description('Pino log level'),
});
//# sourceMappingURL=validation.schema.js.map