import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

interface PinoRequest {
  method: string;
  url: string;
  params: unknown;
  query: unknown;
  user?: {
    id: string;
    householdId: string;
  };
  headers: Record<string, string | undefined>;
}

interface PinoResponse {
  statusCode: number;
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get<string>('config.logging.level') || 'info',
          ...(configService.get<boolean>('config.logging.prettyPrint') && {
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
            req: (req: PinoRequest) => ({
              method: req.method,
              url: req.url,
              params: req.params,
              query: req.query,
            }),
            res: (res: PinoResponse) => ({
              statusCode: res.statusCode,
            }),
          },
          customProps: (req: PinoRequest) => ({
            userId: req.user?.id,
            householdId: req.user?.householdId,
            requestId: req.headers['x-request-id'],
          }),
        },
      }),
    }),
  ],
})
export class LoggingModule {}
