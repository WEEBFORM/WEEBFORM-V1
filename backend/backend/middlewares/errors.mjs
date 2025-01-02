// Define custom error handling middleware
 export function errorHandler(err, req, res, next) {
    console.error(err.stack)
    if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Duplicate entry', message: error.sqlMessage });
        // Other expected errors
    } 
    res.status(500).json('Server-side error')
    next(err)
}

export default errorHandler

