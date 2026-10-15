import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import { HikvisionClient, HikvisionError } from '../../src/index.js';
import { actions, executeAction } from './actions.js';

const connectionSchema = {
  type: 'object', additionalProperties: false, required: ['baseUrl', 'username', 'password'], properties: {
    baseUrl: { type: 'string', maxLength: 512 }, username: { type: 'string', maxLength: 128 },
    password: { type: 'string', maxLength: 256 }, timeout: { type: 'integer', minimum: 1000, maximum: 60000 },
    allowSelfSigned: { type: 'boolean' },
  },
};

export function buildWebExample() {
  const app = Fastify({ logger: false, bodyLimit: 20 * 1024 * 1024, ajv: { customOptions: { removeAdditional: false } } });
  const assets = { '/': ['index.html', 'text/html; charset=utf-8'],
    '/app.js': ['app.js', 'application/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'],
    '/connection.js': ['connection.js', 'application/javascript; charset=utf-8'],
    '/sdk-example.js': ['sdk-example.js', 'application/javascript; charset=utf-8'] };
  for (const [path, [file, contentType]] of Object.entries(assets)) {
    app.get(path, async (_, reply) => reply.type(contentType).header('Cache-Control', 'no-store')
      .header('Content-Security-Policy', "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'; form-action 'self'")
      .header('X-Content-Type-Options', 'nosniff').send(await readFile(new URL(`./public/${file}`, import.meta.url))));
  }
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    const origin = request.headers.origin;
    if (origin && origin !== `http://${request.headers.host}`) {
      return reply.code(403).send({ ok: false, error: { code: 'ORIGIN_NOT_ALLOWED', message: '请从本地测试页面发起请求。' } });
    }
  });
  app.get('/api/actions', async () => actions);
  const handle = execute => async (request, reply) => {
    const controller = new AbortController();
    const disconnected = () => { if (!reply.raw.writableEnded) controller.abort(); };
    const timer = setTimeout(() => controller.abort(), 120000); timer.unref();
    reply.raw.once('close', disconnected);
    try {
      const { connection } = request.body;
      const client = new HikvisionClient({ ...connection, tls: { rejectUnauthorized: !connection.allowSelfSigned } });
      return { ok: true, result: await execute(client, request.body, controller.signal) };
    } catch (error) {
      if (!(error instanceof HikvisionError)) throw error;
      return reply.code(error.code === 'INVALID_ARGUMENT' ? 400 : 502).send({ ok: false,
        error: { code: error.code, message: error.message, ...(error.outcome ? { outcome: error.outcome } : {}) },
        ...(error.response ? { result: error.response } : {}) });
    } finally { clearTimeout(timer); reply.raw.off('close', disconnected); }
  };
  app.post('/api/request', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['connection', 'path'], properties: {
      connection: connectionSchema, path: { type: 'string', minLength: 1, maxLength: 4096 },
    } } },
  }, handle((client, { path }, signal) => client.request({ path, signal })));
  app.post('/api/sdk', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['connection', 'action', 'params'], properties: {
      connection: connectionSchema, action: { type: 'string', enum: actions.map(action => action.id) },
      params: { type: 'object', additionalProperties: true }, confirmed: { type: 'boolean' },
    } } },
  }, handle((client, { action, params, confirmed }, signal) => {
    if (actions.find(item => item.id === action).write && confirmed !== true) {
      throw new HikvisionError('INVALID_ARGUMENT', '此操作会修改设备，请先勾选确认。');
    }
    return executeAction(client, action, params, { signal });
  }));
  app.setErrorHandler((error, _, reply) => {
    const status = error.validation ? 400 : error.statusCode === 413 ? 413 : 500;
    reply.code(status).send({ ok: false, error: { code: status === 400 ? 'INVALID_ARGUMENT' : 'REQUEST_ERROR',
      message: status === 400 ? '连接参数或请求参数格式不正确。' : status === 413 ? '请求内容过大。' : '测试服务处理请求失败。' } });
  });
  return app;
}
