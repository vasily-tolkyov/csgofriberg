import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const ANON_COOKIE_NAME = 'lol_guess_anon';
export const ANON_HEADER_NAME = 'x-anon-token';
const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
const TOKEN_PATTERN = /^[a-zA-Z0-9._-]{16,200}$/;

declare global {
  namespace Express {
    interface Request {
      anonymousId?: string;
    }
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((chunk) => {
      const separator = chunk.indexOf('=');
      const key = separator >= 0 ? chunk.slice(0, separator).trim() : chunk.trim();
      const rawValue = separator >= 0 ? chunk.slice(separator + 1).trim() : '';
      try {
        return [key, decodeURIComponent(rawValue)];
      } catch {
        return [key, rawValue];
      }
    })
  );
}

function isValidToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

function appendCookie(res: Response, token: string): void {
  const parts = [
    `${ANON_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

export function anonymousSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const headerToken = req.header(ANON_HEADER_NAME);
  const cookieToken = parseCookies(req.headers.cookie)[ANON_COOKIE_NAME];
  const chosenToken = isValidToken(headerToken)
    ? headerToken
    : isValidToken(cookieToken)
      ? cookieToken
      : randomUUID().replace(/-/g, '');

  req.anonymousId = chosenToken;
  res.setHeader('X-Anon-Token', chosenToken);

  if (chosenToken !== cookieToken) {
    appendCookie(res, chosenToken);
  }

  next();
}
