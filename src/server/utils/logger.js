import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Define log formats
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
  )
);

// Set up transports
const transports = [
  // Console transport for immediate feedback
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info',
  }),
];

// Add file transports only in non-test environment
if (process.env.NODE_ENV !== 'test') {
  // Error logs
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
    })
  );

  // All logs
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    })
  );
}

// Create the logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  // Do not exit on uncaught errors
  exitOnError: false,
});

// Stream for integrating with Express morgan
export const stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Debug logger that uses console.error to avoid interfering with MCP
export const debugLog = (message, ...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[DEBUG] ${message}`, ...args);
  }
};

// Performance logger for timing operations
export const perfLogger = {
  start: (label) => {
    if (process.env.NODE_ENV !== 'production') {
      console.time(`⏱️ ${label}`);
    }
  },
  end: (label) => {
    if (process.env.NODE_ENV !== 'production') {
      console.timeEnd(`⏱️ ${label}`);
    }
  }
};
