import fp from 'fastify-plugin';

async function errorHandlerPlugin(app) {
  app.setErrorHandler((error, request, reply) => {
    const status = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 599
      ? error.statusCode : 500;
    if (status >= 500) request.log.error({ err: error }, 'Request failed');
    reply.code(status).send({
      error: error.validation ? 'VALIDATION_ERROR' : 'REQUEST_ERROR',
      message: status >= 500 ? '服务内部错误。' : error.message,
    });
  });
}

export default fp(errorHandlerPlugin, { name: 'error-handler', fastify: '5.x' });
