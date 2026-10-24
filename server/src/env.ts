import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3333),
  jwtSecret: required('JWT_SECRET', 'dev-secret-trocar'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Taxa de comissão em pontos-base (1000 = 10%). Usada a partir de C08.
  commissionRateBps: Math.round(Number(process.env.COMMISSION_RATE ?? '0.10') * 10000),
};
