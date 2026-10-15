import { createHash, randomBytes } from 'node:crypto';
import { HikvisionError } from '../sdk-error.js';

export function parseChallenge(header) {
  if (typeof header !== 'string' || !/^Digest\s/i.test(header)) {
    throw new HikvisionError('UNSUPPORTED_AUTH', '设备未提供支持的 Digest 认证方式。');
  }
  const values = {};
  const pattern = /([\w-]+)\s*=\s*(?:"((?:\\.|[^"\\])*)"|([^,\s]+))/g;
  for (const match of header.slice(7).matchAll(pattern)) {
    values[match[1].toLowerCase()] = match[2] === undefined
      ? match[3] : match[2].replace(/\\(.)/g, '$1');
  }
  if (!values.realm || !values.nonce) throw new HikvisionError('UNSUPPORTED_AUTH', '设备认证挑战缺少 realm 或 nonce。');
  return values;
}

export function digestAuthorization(challenge, { username, password, method, uri }) {
  const algorithm = (challenge.algorithm ?? 'MD5').toUpperCase();
  const hashName = { MD5: 'md5', 'SHA-256': 'sha256', 'SHA-512-256': 'sha512-256' }[algorithm.replace(/-SESS$/, '')];
  if (!hashName || challenge.userhash === 'true') {
    throw new HikvisionError('UNSUPPORTED_AUTH', '设备要求的 Digest 认证参数尚不支持。');
  }
  const qops = challenge.qop?.split(',').map(value => value.trim().toLowerCase());
  if (qops && !qops.includes('auth')) throw new HikvisionError('UNSUPPORTED_AUTH', '设备未提供 Digest qop=auth。');
  const hash = value => createHash(hashName).update(value, 'utf8').digest('hex');
  const cnonce = randomBytes(16).toString('hex');
  const nc = '00000001';
  let ha1 = hash(`${username}:${challenge.realm}:${password}`);
  if (algorithm.endsWith('-SESS')) ha1 = hash(`${ha1}:${challenge.nonce}:${cnonce}`);
  const ha2 = hash(`${method}:${uri}`);
  const response = qops ? hash(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:auth:${ha2}`)
    : hash(`${ha1}:${challenge.nonce}:${ha2}`);
  const quote = value => `"${String(value).replace(/["\\]/g, '\\$&')}"`;
  const parts = [`username=${quote(username)}`, `realm=${quote(challenge.realm)}`,
    `nonce=${quote(challenge.nonce)}`, `uri=${quote(uri)}`, `response=${quote(response)}`, `algorithm=${algorithm}`];
  if (challenge.opaque !== undefined) parts.push(`opaque=${quote(challenge.opaque)}`);
  if (qops) parts.push('qop=auth', `nc=${nc}`, `cnonce=${quote(cnonce)}`);
  else if (algorithm.endsWith('-SESS')) parts.push(`cnonce=${quote(cnonce)}`);
  return 'Digest ' + parts.join(', ');
}
