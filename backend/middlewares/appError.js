import AppError from '../utils/appError.js';
import logger from '../utils/logger.js';

// DB ERROR HANDLER
export const handleDBError = (err) => {
  if (err.code === 'ER_DUP_ENTRY') {
    const value = err.sqlMessage.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. This value is already taken.`;
    return new AppError(message, 400); // 400 Bad Request
  }
  
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return new AppError('The resource you are trying to associate with does not exist.', 400);
  }
  
  if (err.code === 'ER_DATA_TOO_LONG') {
    const field = err.sqlMessage.match(/'([^']*)'/)[1];
    return new AppError(`The data provided for the '${field}' field is too long.`, 400);
  }
  
  return new AppError('A database error occurred. Please try again later.', 500);
};

// JWT ERROR HANDLERS
export const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401); 
export const handleJWTExpiredError = () => new AppError('Your session has expired. Please log in again.', 401);

// JOI VALIDATION ERROR HANDLER
export const handleValidationErrorJoi = (err) => {
  const message = err.details.map((el) => el.message).join('. ');
  return new AppError(`Invalid input data: ${message}`, 400);
};

// MULTER ERROR HANDLER
export const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File is too large. Please upload a smaller file.', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Too many files or unexpected file field. Please check your upload.', 400);
  }
  return new AppError('An error occurred during file upload.', 400);
};

// SENDS DETAILED ERROR RESPONSE IN DEVELOPMENT ENVIRONMENT
export const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

// SENDS GENERIC ERROR RESPONSE IN PRODUCTION ENVIRONMENT
export const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

// PROGRAMMING OR UNKNOWN ERROR: DON'T LEAK DETAILS TO CLIENT
  logger.error('PRODUCTION ERROR', err);

  return res.status(500).json({
    status: 'error',
    message: 'Something went very wrong on our end. We are looking into it!',
  });
};

// GLOBAL ERROR HANDLER MIDDLEWARE
export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err, message: err.message, name: err.name, code: err.code, isJoi: err.isJoi };

    // TRANSFORM SPECIFIC ERRORS
    if (error.isJoi) error = handleValidationErrorJoi(error);
    if (error.code && error.code.startsWith('ER_')) error = handleDBError(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'MulterError') error = handleMulterError(error);

    sendErrorProd(error, res);
  }
};

export default globalErrorHandler;