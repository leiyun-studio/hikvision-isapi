import Fastify from 'fastify';
import errorHandlerPlugin from './plugins/error-handler.js';
import healthRoutes from './routes/health.js';

// 创建应用和监听端口分开，便于使用 app.inject() 测试。
export function buildApp({ logger = false } = {}) {
  const app = Fastify({ logger });
  app.register(errorHandlerPlugin);
  app.register(healthRoutes);
  return app;
}
