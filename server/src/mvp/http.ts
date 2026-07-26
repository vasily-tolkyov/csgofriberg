import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';
import { AppError } from './errors';

function validatePart(schema: ZodTypeAny, part: 'body' | 'query' | 'params') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return res.status(400).json({
        code: 'VALIDATION_FAILED',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    req[part] = result.data;
    next();
  };
}

export function validateBody(schema: ZodTypeAny) {
  return validatePart(schema, 'body');
}

export function validateQuery(schema: ZodTypeAny) {
  return validatePart(schema, 'query');
}

export function validateParams(schema: ZodTypeAny) {
  return validatePart(schema, 'params');
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ code: err.code, ...err.details });
  }
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    return res.status(400).json({ code: 'INVALID_JSON' });
  }
  if (err instanceof Error && err.message === 'REDIS_UNAVAILABLE') {
    return res.status(503).json({ code: 'REDIS_UNAVAILABLE' });
  }
  if (err instanceof Error && err.message === 'RESOURCE_BUSY') {
    return res.status(409).json({ code: 'RESOURCE_BUSY' });
  }
  console.error('[mvp:error]', err);
  return res.status(500).json({ code: 'INTERNAL_ERROR' });
}
