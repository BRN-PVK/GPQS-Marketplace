import type { NextFunction, Request, Response } from 'express';

// Encapsula handlers async para que rejeições cheguem ao errorHandler (Express 4).
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
