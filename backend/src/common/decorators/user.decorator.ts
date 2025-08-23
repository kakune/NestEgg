import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request: { user?: Record<string, unknown> } = ctx
      .switchToHttp()
      .getRequest();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
