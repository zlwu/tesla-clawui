import { createApp } from './app.js';

const { app, config } = createApp();

app.listen({ port: config.port, host: config.host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
