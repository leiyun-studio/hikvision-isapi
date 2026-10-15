import { peopleResource } from './people.js';
import { facesResource } from './faces.js';
import { eventsResource } from './events.js';
import { imagesResource } from './images.js';
import { deviceResource } from './device.js';
import { HikvisionError } from '../sdk-error.js';

function doorId(id) {
  if (!Number.isInteger(id) || id < 1 || id > 65535) throw new HikvisionError('INVALID_ARGUMENT', '门编号必须为 1–65535 的整数。');
  return id;
}
export function createResources(client) {
  const control = (id, command, { signal } = {}) => {
    if (!['open', 'close', 'alwaysOpen', 'alwaysClose'].includes(command)) throw new HikvisionError('INVALID_ARGUMENT', '不支持的门控制命令。');
    return client.request({ method: 'PUT', path: `/ISAPI/AccessControl/RemoteControl/door/${doorId(id)}`,
      contentType: 'application/xml; charset=utf-8', signal,
      body: `<RemoteControlDoor version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><cmd>${command}</cmd></RemoteControlDoor>` });
  };
  return {
    device: deviceResource(client),
    users: peopleResource(client, 'users'), cards: peopleResource(client, 'cards'), faces: facesResource(client),
    events: eventsResource(client), images: imagesResource(client),
    doors: Object.freeze({
      getStatus: (options = {}) => client.request({ path: '/ISAPI/AccessControl/AcsWorkStatus', signal: options.signal }),
      capabilities: (options = {}) => client.request({ path: '/ISAPI/AccessControl/RemoteControl/door/capabilities', signal: options.signal }),
      control, open: (id = 1, options) => control(id, 'open', options), close: (id = 1, options) => control(id, 'close', options),
    }),
  };
}
