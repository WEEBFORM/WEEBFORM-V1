import AppError from '../utils/appError.js';
import logger from '../utils/logger.js';

export const handleDBError = (err) => { 
  // Handle validation errors from the database
  if (err.code === 'ER_DUP_ENTRY') {
    const value = err.sqlMessage.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. This value is already taken.`;
    return new AppError(message, 400); // 400 Bad Request
  }
  // Handle foreign key constraint errors
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return new AppError('The resource you are trying to associate with does not exist.', 400);
  }
  // Handle data type errors
  if (err.code === 'ER_DATA_TOO_LONG') {
    const field = err.sqlMessage.match(/'([^']*)'/)[1];
    return new AppError(`The data provided for the '${field}' field is too long.`, 400);
  }
  // Handle other database errors
  return new AppError('A database error occurred. Please try again later.', 500);
};

// Handles JWT errors, such as invalid or expired tokens
export const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401); 
export const handleJWTExpiredError = () => new AppError('Your session has expired. Please log in again.', 401);
// Handles Joi validation errors, which are common in request validation
export const handleValidationErrorJoi = (err) => {
  const message = err.details.map((el) => el.message).join('. ');
  return new AppError(`Invalid input data: ${message}`, 400);
};

// Handles Multer errors, which occur during file uploads
export const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File is too large. Please upload a smaller file.', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Too many files or unexpected file field. Please check your upload.', 400);
  }
  return new AppError('An error occurred during file upload.', 400);
};

// Sends a detailed error response in the development environment.
export const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

// Sends a generic error response in the production environment.
export const sendErrorProd = (err, res) => {
  // A) Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

// Programming or other unknown error: don't leak error detailsqqq
  logger.error('PRODUCTION ERROR', err);

  // Send a generic message
  return res.status(500).json({
    status: 'error',
    message: 'Something went very wrong on our end. We are looking into it!',
  });
};

/**
 * The main global error handling middleware.
 * It catches all errors passed to next() and formats the response based on the environment.
 */
export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err, message: err.message, name: err.name, code: err.code, isJoi: err.isJoi };

    // Transform specific known errors into operational AppErrors
    if (error.isJoi) error = handleValidationErrorJoi(error);
    if (error.code && error.code.startsWith('ER_')) error = handleDBError(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'MulterError') error = handleMulterError(error);

    sendErrorProd(error, res);
  }
};

export default globalErrorHandler;