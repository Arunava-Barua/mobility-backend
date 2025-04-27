import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

/**
 * Validates request body against a Joi schema
 * @param schema Joi schema to validate against
 * @returns Express middleware function
 */
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      logger.warn(`Validation error: ${errorMessages.join(', ')}`);
      
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        errors: errorMessages
      });
    }
    
    next();
  };
};

/**
 * Validates request params against a Joi schema
 * @param schema Joi schema to validate against
 * @returns Express middleware function
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.params, { abortEarly: false });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      logger.warn(`Validation error in params: ${errorMessages.join(', ')}`);
      
      return res.status(400).json({
        status: 'error',
        message: 'Validation error in URL parameters',
        errors: errorMessages
      });
    }
    
    next();
  };
};

/**
 * Validates request query against a Joi schema
 * @param schema Joi schema to validate against
 * @returns Express middleware function
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query, { abortEarly: false, allowUnknown: true });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      logger.warn(`Validation error in query: ${errorMessages.join(', ')}`);
      
      return res.status(400).json({
        status: 'error',
        message: 'Validation error in query parameters',
        errors: errorMessages
      });
    }
    
    next();
  };
};