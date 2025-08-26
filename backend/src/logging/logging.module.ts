import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { IncomingMessage } from 'http';

interface PinoRequest extends IncomingMessage {
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
          customProps: (req: IncomingMessage) => ({
            userId: (req as PinoRequest).user?.id,
            householdId: (req as PinoRequest).user?.householdId,
            requestId: (req as PinoRequest).headers['x-request-id'],
          }),
        },
      }),
    }),
  ],
})
export class LoggingModule {}
