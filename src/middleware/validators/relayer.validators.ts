import Joi from 'joi';

/**
 * Schema for validating transaction submission request
 * Note: This schema is temporarily disabled until full implementation
 */
/*
export const submitTransactionSchema = Joi.object({
  transaction: Joi.object().required().messages({
    'any.required': 'Transaction data is required'
  }),
  signature: Joi.string().required().messages({
    'any.required': 'Signature is required',
    'string.empty': 'Signature cannot be empty'
  })
});
*/

// Keep an export to avoid breaking imports
export const submitTransactionSchema = Joi.object({});

/**
 * Schema for validating deposit processing request
 */
export const processDepositSchema = Joi.object({
  suiAddress: Joi.string().required().pattern(/^0x[a-fA-F0-9]+$/).messages({
    'any.required': 'Sui address is required',
    'string.empty': 'Sui address cannot be empty',
    'string.pattern.base': 'Sui address must be a valid hexadecimal address starting with 0x'
  }),
  bitcoinAddress: Joi.string().required().min(26).max(35).messages({
    'any.required': 'Bitcoin address is required',
    'string.empty': 'Bitcoin address cannot be empty',
    'string.min': 'Bitcoin address must be at least 26 characters',
    'string.max': 'Bitcoin address must be at most 35 characters'
  }),
  bitcoinTxHash: Joi.string().required().pattern(/^[a-fA-F0-9]{64}$/).messages({
    'any.required': 'Bitcoin transaction hash is required',
    'string.empty': 'Bitcoin transaction hash cannot be empty',
    'string.pattern.base': 'Bitcoin transaction hash must be a valid 64-character hexadecimal string'
  })
});

/**
 * Schema for validating transaction status request params
 */
export const transactionStatusParamsSchema = Joi.object({
  txId: Joi.string().required().messages({
    'any.required': 'Transaction ID is required',
    'string.empty': 'Transaction ID cannot be empty'
  })
});

/**
 * Schema for validating transactions list query
 */
export const transactionsListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be at least 1'
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be an integer',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100'
  })
});

/**
 * Schema for validating withdrawal address parameter
 */
export const withdrawalAddressParamSchema = Joi.object({
  suiAddress: Joi.string().required().pattern(/^0x[a-fA-F0-9]+$/).messages({
    'any.required': 'Sui address is required',
    'string.empty': 'Sui address cannot be empty',
    'string.pattern.base': 'Sui address must be a valid hexadecimal address starting with 0x'
  })
});