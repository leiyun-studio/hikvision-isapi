export class HikvisionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'HikvisionError';
    this.code = code;
    Object.assign(this, details);
  }
}
