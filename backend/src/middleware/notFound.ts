import { Request, Response } from 'express';
import { applyCorsHeaders } from '../config/cors';

export const notFound = (req: Request, res: Response): void => {
  applyCorsHeaders(req, res);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
};









