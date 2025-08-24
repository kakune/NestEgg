import {
  ValidationPipe as NestValidationPipe,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';

export class ValidationPipe extends NestValidationPipe {
  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (validationErrors: ValidationError[] = []) => {
        const errors = this.flattenValidationErrors(validationErrors);
        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
        });
      },
    });
  }

  private flattenValidationErrors(
    validationErrors: ValidationError[],
    parentPath = '',
  ): Array<{ field: string; code: string; message: string }> {
    const errors: Array<{ field: string; code: string; message: string }> = [];

    for (const error of validationErrors) {
      const fieldPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      if (error.constraints) {
        for (const [constraintKey, constraintValue] of Object.entries(
          error.constraints,
        )) {
          errors.push({
            field: fieldPath,
            code: this.getValidationErrorCode(constraintKey),
            message: constraintValue,
          });
        }
      }

      if (error.children && error.children.length > 0) {
        errors.push(...this.flattenValidationErrors(error.children, fieldPath));
      }
    }

    return errors;
  }

  private getValidationErrorCode(constraintKey: string): string {
    const codeMap: { [key: string]: string } = {
      isNotEmpty: 'REQUIRED_FIELD_MISSING',
      isString: 'INVALID_STRING',
      isInt: 'INVALID_INTEGER',
      isNumber: 'INVALID_NUMBER',
      isBoolean: 'INVALID_BOOLEAN',
      isArray: 'INVALID_ARRAY',
      isUUID: 'INVALID_UUID',
      isEnum: 'INVALID_ENUM_VALUE',
      isDateString: 'INVALID_DATE_FORMAT',
      isEmail: 'INVALID_EMAIL',
      min: 'VALUE_TOO_SMALL',
      max: 'VALUE_TOO_LARGE',
      minLength: 'STRING_TOO_SHORT',
      maxLength: 'STRING_TOO_LONG',
      isPositive: 'MUST_BE_POSITIVE',
      arrayMinSize: 'ARRAY_TOO_SMALL',
      arrayMaxSize: 'ARRAY_TOO_LARGE',
      matches: 'INVALID_FORMAT',
      isOptional: 'VALIDATION_ERROR',
    };

    return codeMap[constraintKey] || 'VALIDATION_ERROR';
  }
}
