"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingModule = void 0;
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const config_1 = require("@nestjs/config");
let LoggingModule = class LoggingModule {
};
exports.LoggingModule = LoggingModule;
exports.LoggingModule = LoggingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            nestjs_pino_1.LoggerModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    pinoHttp: {
                        level: configService.get('config.logging.level') || 'info',
                        ...(configService.get('config.logging.prettyPrint') && {
                            transport: {
                                target: 'pino-pretty',
                                options: {
                                    colorize: true,
                                    translateTime: 'SYS:standard',
                                    ignore: 'pid,hostname',
                                },
                            },
                        }),
                        serializers: {
                            req: (req) => ({
                                method: req.method,
                                url: req.url,
                                params: req.params,
                                query: req.query,
                            }),
                            res: (res) => ({
                                statusCode: res.statusCode,
                            }),
                        },
                        customProps: (req) => ({
                            userId: req.user?.id,
                            householdId: req.user?.householdId,
                            requestId: req.headers['x-request-id'],
                        }),
                    },
                }),
            }),
        ],
    })
], LoggingModule);
//# sourceMappingURL=logging.module.js.map