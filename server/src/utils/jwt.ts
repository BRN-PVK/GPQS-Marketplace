import jwt from 'jsonwebtoken';
import type { Role } from '../types.js';
import { env } from '../env.js';

export interface TokenPayload {
  sub: string; // user id
  role: Role;
  name: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}
