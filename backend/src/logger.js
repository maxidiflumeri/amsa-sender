// backend/logger.js
const winston = require('winston');
require('winston-daily-rotate-file');

// Formato común para consola y archivos
const logFormat = winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
});

// Transportes para archivos con rotación diaria
const fileRotateTransport = (level) =>
    new winston.transports.DailyRotateFile({
        filename: `logs/${level}-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '10m',
        maxFiles: '14d',
        level,
    });

// Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    transports: [
        fileRotateTransport('info'),
        fileRotateTransport('error'),
        fileRotateTransport('warn'),
    ],
});

// Mostrar por consola también (excepto en producción pura si no quieres)
if (process.env.NODE_ENV !== 'production') {
    const consoleFormat = winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level}: ${message}`;
        })
    );

    logger.add(new winston.transports.Console({ format: consoleFormat }));
}

module.exports = logger;