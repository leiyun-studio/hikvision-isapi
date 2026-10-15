import { identifier, object, position, page, iterate } from './common.js';
import { runBatch, deleteBatch } from './batch.js';

export function peopleResource(client, kind) {
  const users = kind === 'users';
  const prefix = users ? 'UserInfo' : 'CardInfo';
  const path = `/ISAPI/AccessControl/${prefix}`;
  const search = async (options = {}) => {
    const { employeeNo, cardNo, signal, filters = {} } = options;
    const cond = { ...object(filters, 'filters'), ...position(options) };
    if (employeeNo !== undefined) cond.EmployeeNoList = [{ employeeNo: identifier(employeeNo, 'employeeNo') }];
    if (!users && cardNo !== undefined) cond.CardNoList = [{ cardNo: identifier(cardNo, 'cardNo') }];
    const response = await client.request({ method: 'POST', path: `${path}/Search?format=json`, signal,
      body: { [`${prefix}SearchCond`]: cond } });
    return page(response, `${prefix}Search`, [prefix], options.offset ?? 0, cond.searchID);
  };
  const write = (action, method, data, options = {}) => {
    object(data);
    if (users || ['Record', 'SetUp'].includes(action) || data.employeeNo !== undefined) identifier(data.employeeNo, 'employeeNo');
    if (!users) identifier(data.cardNo, 'cardNo');
    return client.request({ method, path: `${path}/${action}?format=json`, body: { [prefix]: data }, signal: options.signal });
  };
  const remove = (ids, signal) => client.request({ method: 'PUT', signal,
    path: users ? '/ISAPI/AccessControl/UserInfoDetail/Delete?format=json' : `${path}/Delete?format=json`,
    body: users ? { UserInfoDetail: { mode: 'byEmployeeNo', EmployeeNoList: ids.map(employeeNo => ({ employeeNo })) } }
      : { CardInfoDelCond: { CardNoList: ids.map(cardNo => ({ cardNo })) } },
  });
  const getId = data => object(data)[users ? 'employeeNo' : 'cardNo'];
  return Object.freeze({
    search,
    iterate: options => iterate(search, options),
    count: (options = {}) => client.request({ path: `${path}/Count?format=json`, signal: options.signal }),
    capabilities: (options = {}) => client.request({ path: `${path}/capabilities?format=json`, signal: options.signal }),
    create: (data, options) => write('Record', 'POST', data, options),
    set: (data, options) => write('SetUp', 'PUT', data, options),
    update: (id, data, options) => write('Modify', 'PUT', { ...object(data), [users ? 'employeeNo' : 'cardNo']: identifier(id) }, options),
    delete: (id, options = {}) => remove([identifier(id, users ? 'employeeNo' : 'cardNo')], options.signal),
    createMany: (items, options) => runBatch(items, getId, (data, signal) => write('Record', 'POST', data, { signal }), options),
    updateMany: (items, options) => runBatch(items, getId, (data, signal) => write('Modify', 'PUT', data, { signal }), options),
    setMany: (items, options) => runBatch(items, getId, (data, signal) => write('SetUp', 'PUT', data, { signal }), options),
    deleteMany: (ids, options) => deleteBatch(ids, remove, (id, signal) => remove([id], signal), options),
    ...(users ? { getDeleteProgress: (options = {}) => client.request({ path: '/ISAPI/AccessControl/UserInfoDetail/DeleteProcess?format=json', signal: options.signal }) } : {}),
  });
}
