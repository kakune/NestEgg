declare const _default: (() => {
    database: {
        url: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    app: {
        port: number;
        environment: string;
    };
    security: {
        bcryptRounds: number;
        corsOrigin: string;
        rateLimitTtl: number;
        rateLimitMax: number;
    };
    logging: {
        level: string;
        prettyPrint: boolean;
    };
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    database: {
        url: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    app: {
        port: number;
        environment: string;
    };
    security: {
        bcryptRounds: number;
        corsOrigin: string;
        rateLimitTtl: number;
        rateLimitMax: number;
    };
    logging: {
        level: string;
        prettyPrint: boolean;
    };
}>;
export default _default;
