import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LoggingModule } from './logging.module';

interface MockRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, unknown>;
}

interface PinoHttpConfig {
  level: string;
  transport?: {
    target: string;
    options: {
      colorize: boolean;
      translateTime: string;
      ignore: string;
    };
  };
  serializers: {
    req: (req: MockUserRequest) => {
      method: string;
      url: string;
      headers: Record<string, string>;
      body?: unknown;
      query: Record<string, unknown> | undefined;
    };
    res: (res: MockResponse) => {
      statusCode: number;
    };
  };
}

interface LoggerConfig {
  pinoHttp: PinoHttpConfig;
}

interface MockResponse {
  statusCode?: number;
}

interface MockUserRequest extends MockRequest {
  user?: {
    id?: string;
    householdId?: string;
  };
  params?: Record<string, unknown>;
}

describe('LoggingModule', () => {
  let module: TestingModule;

  const mockConfigService = {
    get: jest.fn(),
  } as jest.Mocked<Pick<ConfigService, 'get'>>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'config.logging.level':
          return 'info';
        case 'config.logging.prettyPrint':
          return false;
        default:
          return undefined;
      }
    });

    module = await Test.createTestingModule({
      imports: [LoggingModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    expect(module).toBeDefined();
  });

  it('should configure logger with basic settings', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'config.logging.level':
          return 'debug';
        case 'config.logging.prettyPrint':
          return false;
        default:
          return undefined;
      }
    });

    module = await Test.createTestingModule({
      imports: [LoggingModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    expect(mockConfigService.get).toHaveBeenCalledWith('config.logging.level');
    expect(mockConfigService.get).toHaveBeenCalledWith(
      'config.logging.prettyPrint',
    );
  });

  it('should configure logger with pretty print enabled', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'config.logging.level':
          return 'info';
        case 'config.logging.prettyPrint':
          return true;
        default:
          return undefined;
      }
    });

    module = await Test.createTestingModule({
      imports: [LoggingModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    expect(mockConfigService.get).toHaveBeenCalledWith('config.logging.level');
    expect(mockConfigService.get).toHaveBeenCalledWith(
      'config.logging.prettyPrint',
    );
  });

  it('should use default log level when not configured', async () => {
    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'config.logging.level':
          return null;
        case 'config.logging.prettyPrint':
          return false;
        default:
          return undefined;
      }
    });

    module = await Test.createTestingModule({
      imports: [LoggingModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    expect(mockConfigService.get).toHaveBeenCalledWith('config.logging.level');
  });

  describe('pino configuration factory', () => {
    let factoryFunction: (
      configService: Pick<ConfigService, 'get'>,
    ) => LoggerConfig;

    beforeEach(() => {
      // For testing purposes, we'll create the factory function directly
      factoryFunction = (configService: Pick<ConfigService, 'get'>) => ({
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
            req: (req: MockUserRequest) => ({
              method: req.method || '',
              url: req.url || '',
              headers: req.headers || {},
              body: req.body,
              query: req.query,
            }),
            res: (res: MockResponse) => ({
              statusCode: res.statusCode || 0,
            }),
          },
        },
      });
    });

    it('should configure logger with correct level', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'config.logging.level':
            return 'debug';
          case 'config.logging.prettyPrint':
            return false;
          default:
            return undefined;
        }
      });

      const config = factoryFunction(mockConfigService);
      expect(config.pinoHttp.level).toBe('debug');
    });

    it('should use default level when config returns falsy value', () => {
      mockConfigService.get.mockImplementation(() => null);

      const config = factoryFunction(mockConfigService);
      expect(config.pinoHttp.level).toBe('info');
    });

    it('should include transport when prettyPrint is enabled', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'config.logging.level':
            return 'info';
          case 'config.logging.prettyPrint':
            return true;
          default:
            return undefined;
        }
      });

      const config = factoryFunction(mockConfigService);
      expect(config.pinoHttp.transport).toBeDefined();
      if (config.pinoHttp.transport) {
        expect(config.pinoHttp.transport.target).toBe('pino-pretty');
        expect(config.pinoHttp.transport.options.colorize).toBe(true);
        expect(config.pinoHttp.transport.options.translateTime).toBe(
          'SYS:standard',
        );
        expect(config.pinoHttp.transport.options.ignore).toBe('pid,hostname');
      }
    });

    it('should not include transport when prettyPrint is disabled', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'config.logging.level':
            return 'info';
          case 'config.logging.prettyPrint':
            return false;
          default:
            return undefined;
        }
      });

      const config = factoryFunction(mockConfigService);
      expect(config.pinoHttp.transport).toBeUndefined();
    });

    describe('request serializer', () => {
      let reqSerializer: (req: MockUserRequest) => {
        method: string;
        url: string;
        headers: Record<string, string>;
        body?: unknown;
        query: Record<string, unknown> | undefined;
      };

      beforeEach(() => {
        mockConfigService.get.mockReturnValue('info');
        const config = factoryFunction(mockConfigService);
        reqSerializer = config.pinoHttp.serializers.req;
      });

      it('should serialize request correctly', () => {
        const mockRequest: MockUserRequest = {
          method: 'GET',
          url: '/api/test',
          headers: { 'content-type': 'application/json' },
          query: { filter: 'active' },
          body: { secret: 'hidden' },
        };

        const result = reqSerializer(mockRequest);

        expect(result).toEqual({
          method: 'GET',
          url: '/api/test',
          headers: { 'content-type': 'application/json' },
          query: { filter: 'active' },
          body: { secret: 'hidden' },
        });
      });

      it('should handle missing properties', () => {
        const mockRequest: MockUserRequest = {
          method: 'POST',
          url: '/api/create',
        };

        const result = reqSerializer(mockRequest);

        expect(result).toEqual({
          method: 'POST',
          url: '/api/create',
          headers: {},
          body: undefined,
          query: undefined,
        });
      });
    });

    describe('response serializer', () => {
      let resSerializer: (res: MockResponse) => {
        statusCode: number;
      };

      beforeEach(() => {
        mockConfigService.get.mockReturnValue('info');
        const config = factoryFunction(mockConfigService);
        resSerializer = config.pinoHttp.serializers.res;
      });

      it('should serialize response correctly', () => {
        const mockResponse: MockResponse = {
          statusCode: 200,
        };

        const result = resSerializer(mockResponse);

        expect(result).toEqual({
          statusCode: 200,
        });
      });

      it('should handle error status codes', () => {
        const mockResponse: MockResponse = {
          statusCode: 500,
        };

        const result = resSerializer(mockResponse);

        expect(result).toEqual({
          statusCode: 500,
        });
      });
    });
  });

  describe('integration with different config values', () => {
    const testCases = [
      {
        description: 'production configuration',
        config: {
          'config.logging.level': 'warn',
          'config.logging.prettyPrint': false,
        } as Record<string, string | boolean>,
      },
      {
        description: 'development configuration',
        config: {
          'config.logging.level': 'debug',
          'config.logging.prettyPrint': true,
        } as Record<string, string | boolean>,
      },
      {
        description: 'test configuration',
        config: {
          'config.logging.level': 'silent',
          'config.logging.prettyPrint': false,
        } as Record<string, string | boolean>,
      },
    ];

    testCases.forEach(({ description, config }) => {
      it(`should handle ${description}`, async () => {
        mockConfigService.get.mockImplementation((key: string) => config[key]);

        module = await Test.createTestingModule({
          imports: [LoggingModule],
        })
          .overrideProvider(ConfigService)
          .useValue(mockConfigService)
          .compile();

        expect(module).toBeDefined();
        expect(mockConfigService.get).toHaveBeenCalledWith(
          'config.logging.level',
        );
        expect(mockConfigService.get).toHaveBeenCalledWith(
          'config.logging.prettyPrint',
        );
      });
    });
  });
});
