import { mkdir, writeFile, link, rename, unlink, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HikvisionError } from '../sdk-error.js';

export function imageInfo(bytes) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { contentType: 'image/jpeg', extension: 'jpg' };
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { contentType: 'image/png', extension: 'png' };
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { contentType: 'image/webp', extension: 'webp' };
  throw new HikvisionError('INVALID_IMAGE', '响应不是支持的 JPEG、PNG 或 WebP 图片。');
}

export function imageReferences(record) {
  const images = [];
  for (const key of ['pictureURL', 'picURL', 'PicDataUrl', 'picDataUrl', 'visibleLightPicUrl', 'thermalPicUrl']) {
    if (typeof record?.[key] === 'string' && record[key]) images.push({ type: 'url', url: record[key], field: key });
  }
  if (images.length === 0 && typeof record?.filename === 'string' && record.filename) images.push({ type: 'reference', fileId: record.filename, field: 'filename' });
  return images;
}

export async function saveImage(bytes, filePath, overwrite = false) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new HikvisionError('INVALID_ARGUMENT', 'as=file 时必须填写 filePath。');
  const target = resolve(filePath);
  await mkdir(dirname(target), { recursive: true });
  const temporary = target + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, bytes, { flag: 'wx' });
    if (overwrite) await rename(temporary, target);
    else await link(temporary, target);
    return target;
  } catch (error) {
    if (error.code === 'EEXIST') throw new HikvisionError('FILE_EXISTS', '目标文件已存在；如需覆盖，请显式设置 overwrite=true。');
    throw new HikvisionError('FILE_ERROR', '图片保存失败，请检查目录和文件权限。');
  } finally { await unlink(temporary).catch(() => {}); }
}

export function imagesResource(client) {
  return Object.freeze({
    async download(source, { as = 'buffer', filePath, overwrite = false, allowExternal = false, signal } = {}) {
      if (!['buffer', 'base64', 'file'].includes(as)) throw new HikvisionError('INVALID_ARGUMENT', 'as 必须为 buffer、base64 或 file。');
      if (typeof overwrite !== 'boolean' || typeof allowExternal !== 'boolean') throw new HikvisionError('INVALID_ARGUMENT', 'overwrite 和 allowExternal 必须是布尔值。');
      if (as === 'file' && (typeof filePath !== 'string' || !filePath.trim())) throw new HikvisionError('INVALID_ARGUMENT', 'as=file 时必须填写 filePath。');
      let bytes;
      if (source instanceof Uint8Array) bytes = Buffer.from(source);
      else if (source?.type === 'inline' && source.data instanceof Uint8Array) bytes = Buffer.from(source.data);
      else {
        const url = typeof source === 'string' ? source : source?.type === 'url' ? source.url : undefined;
        if (!url) throw new HikvisionError('IMAGE_UNAVAILABLE', '此事件没有可下载的图片 URL 或内嵌数据。');
        bytes = (await client.downloadBytes(url, { allowExternal, signal })).data;
      }
      if (bytes.length > client.maxImageBytes) throw new HikvisionError('RESPONSE_TOO_LARGE', '图片超过大小限制。');
      imageInfo(bytes);
      if (as === 'base64') return bytes.toString('base64');
      if (as === 'file') return saveImage(bytes, filePath, overwrite);
      return bytes;
    },
  });
}

export async function imageInput(client, image, signal) {
  let bytes;
  if (image instanceof Uint8Array) bytes = Buffer.from(image);
  else if (image?.type === 'file') {
    if (typeof image.path !== 'string' || !image.path) throw new HikvisionError('INVALID_ARGUMENT', '请填写图片文件 path。');
    try {
      if ((await stat(image.path)).size > client.maxImageBytes) throw new HikvisionError('REQUEST_TOO_LARGE', '图片超过大小限制。');
      bytes = await readFile(image.path);
    } catch (error) {
      if (error instanceof HikvisionError) throw error;
      throw new HikvisionError('FILE_ERROR', '无法读取图片文件。');
    }
  } else if (image?.type === 'base64') {
    if (typeof image.data !== 'string' || image.data.length > Math.ceil(client.maxImageBytes / 3) * 4 + 128) throw new HikvisionError('INVALID_ARGUMENT', '图片 Base64 无效或过大。');
    const value = image.data.replace(/^data:image\/[\w.+-]+;base64,/, '');
    if (!value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new HikvisionError('INVALID_ARGUMENT', '图片 Base64 格式无效。');
    bytes = Buffer.from(value, 'base64');
  } else if (image?.type === 'url') {
    bytes = await client.images.download(image.url, { allowExternal: true, signal });
  } else throw new HikvisionError('INVALID_ARGUMENT', 'image 必须是 Buffer 或 url/file/base64 类型的图片。');
  if (bytes.length > client.maxImageBytes) throw new HikvisionError('REQUEST_TOO_LARGE', '图片超过大小限制。');
  const info = imageInfo(bytes);
  if (info.contentType !== 'image/jpeg') throw new HikvisionError('INVALID_IMAGE', '人脸下发请使用 JPEG 图片，SDK 不自动转码。');
  return bytes;
}
