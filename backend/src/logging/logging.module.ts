/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

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
            req: (req: any) => ({
              method: req.method,
              url: req.url,
              params: req.params,
              query: req.query,
            }),
            res: (res: any) => ({
              statusCode: res.statusCode,
            }),
          },
          customProps: (req: any) => ({
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
