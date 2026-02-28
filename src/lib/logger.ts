type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

function emit(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    level,
    msg: message,
    time: new Date().toISOString(),
    ...context,
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
};
