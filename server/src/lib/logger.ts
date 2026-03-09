export const createLoggerOptions = () => ({
  level: process.env.LOG_LEVEL ?? 'info',
});
