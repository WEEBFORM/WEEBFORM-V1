export const errorHandler = (err, req, res, next) => {
    console.error(err); 

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
        message: message,
        error: process.env.NODE_ENV === 'production' ? null : err.stack, // Only send stack trace in development
    });
};