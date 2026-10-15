import type { Buffer } from 'node:buffer';

export type JsonObject = Record<string, unknown>;
export interface RequestOptions { signal?: AbortSignal }
export interface BatchOptions extends RequestOptions { concurrency?: number; stopOnError?: boolean }
export interface BatchDeleteOptions extends BatchOptions { strategy?: 'native' | 'individual' }
export interface BatchItemResult {
  index: number; id: string; status: 'succeeded' | 'accepted' | 'failed' | 'unknown' | 'skipped';
  response?: IsapiResponse; reason?: 'aborted' | 'stopped';
  error?: { code: string; message: string; outcome?: 'unknown'; subStatusCode?: string; response?: IsapiResponse };
}
export interface BatchResult {
  strategy: 'native' | 'individual'; total: number; succeeded: number; accepted: number;
  failed: number; unknown: number; skipped: number; aborted: boolean; results: BatchItemResult[];
  /** Native group acknowledgement; accepted does not imply per-ID deletion completion. */
  response?: IsapiResponse;
}
export interface ClientOptions {
  baseUrl: string; username: string; password: string; timeout?: number;
  tls?: { rejectUnauthorized?: boolean; ca?: string | Buffer | Array<string | Buffer> };
  maxResponseBytes?: number; maxImageBytes?: number;
}
export interface IsapiResponse<T = unknown> {
  status: number; contentType: string; format: 'json' | 'xml' | 'text' | 'binary';
  elapsedMs: number; bytes: number; data: T;
}
export interface RawRequest extends RequestOptions {
  path: string; method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  body?: unknown; contentType?: string; responseType?: 'auto' | 'json' | 'xml' | 'text' | 'buffer'; maxBytes?: number;
}
export interface SearchOptions extends RequestOptions {
  offset?: number; pageSize?: number; searchID?: string; filters?: JsonObject;
}
export interface IterateOptions extends SearchOptions { maxPages?: number }
export interface Page<T> {
  items: T[]; total?: number; hasMore: boolean; searchID: string; nextPosition: number;
  raw: JsonObject; response: IsapiResponse<JsonObject>;
}
export interface UserInfo extends JsonObject { employeeNo: string; name?: string; doorRight?: string }
export interface CardInfo extends JsonObject { employeeNo: string; cardNo: string; cardType?: string }
export interface PeopleSearch extends SearchOptions { employeeNo?: string }
export interface CardSearch extends PeopleSearch { cardNo?: string }
export interface UserResource {
  search(options?: PeopleSearch): Promise<Page<UserInfo>>;
  iterate(options?: PeopleSearch & IterateOptions): AsyncGenerator<UserInfo>;
  count(options?: RequestOptions): Promise<IsapiResponse>;
  capabilities(options?: RequestOptions): Promise<IsapiResponse>;
  create(person: UserInfo, options?: RequestOptions): Promise<IsapiResponse>;
  set(person: UserInfo, options?: RequestOptions): Promise<IsapiResponse>;
  update(employeeNo: string, changes: Partial<UserInfo>, options?: RequestOptions): Promise<IsapiResponse>;
  createMany(people: UserInfo[], options?: BatchOptions): Promise<BatchResult>;
  setMany(people: UserInfo[], options?: BatchOptions): Promise<BatchResult>;
  updateMany(people: Array<Partial<UserInfo> & { employeeNo: string }>, options?: BatchOptions): Promise<BatchResult>;
  deleteMany(employeeNos: string[], options?: BatchDeleteOptions): Promise<BatchResult>;
  getDeleteProgress(options?: RequestOptions): Promise<IsapiResponse>;
  /** Requests deletion of this employee and its associated permissions. Device completion behavior varies by firmware. */
  delete(employeeNo: string, options?: RequestOptions): Promise<IsapiResponse>;
}
export interface CardResource {
  search(options?: CardSearch): Promise<Page<CardInfo>>;
  iterate(options?: CardSearch & IterateOptions): AsyncGenerator<CardInfo>;
  count(options?: RequestOptions): Promise<IsapiResponse>;
  capabilities(options?: RequestOptions): Promise<IsapiResponse>;
  create(card: CardInfo, options?: RequestOptions): Promise<IsapiResponse>;
  set(card: CardInfo, options?: RequestOptions): Promise<IsapiResponse>;
  update(cardNo: string, changes: Partial<CardInfo>, options?: RequestOptions): Promise<IsapiResponse>;
  createMany(cards: CardInfo[], options?: BatchOptions): Promise<BatchResult>;
  setMany(cards: CardInfo[], options?: BatchOptions): Promise<BatchResult>;
  updateMany(cards: Array<Partial<CardInfo> & { cardNo: string }>, options?: BatchOptions): Promise<BatchResult>;
  deleteMany(cardNos: string[], options?: BatchDeleteOptions): Promise<BatchResult>;
  delete(cardNo: string, options?: RequestOptions): Promise<IsapiResponse>;
}
export type EventImage = { type: 'url'; url: string; field?: string }
  | { type: 'reference'; fileId: string; field?: string }
  | { type: 'inline'; data: Uint8Array; contentType?: string; filename?: string };
export interface AccessEvent extends JsonObject {
  serialNo?: number; employeeNoString?: string; time?: string; major?: number; minor?: number;
  images: EventImage[]; raw: JsonObject;
}
export interface EventSearch extends SearchOptions {
  startTime?: string; endTime?: string; major?: number; minor?: number; employeeNo?: string; includePictures?: boolean;
}
export interface SubscriptionOptions extends RequestOptions {
  reconnect?: boolean; maxReconnects?: number; reconnectDelay?: number; idleTimeout?: number;
}
export interface LiveEvent {
  kind: 'event' | 'image'; event?: unknown; raw?: unknown; images: EventImage[]; complete: boolean;
}
export interface EventResource {
  search(options?: EventSearch): Promise<Page<AccessEvent>>;
  iterate(options?: EventSearch & IterateOptions): AsyncGenerator<AccessEvent>;
  capabilities(options?: RequestOptions): Promise<IsapiResponse>;
  /** No automatic reconnect unless requested. No exactly-once delivery or historical backfill guarantee. */
  subscribe(options?: SubscriptionOptions): AsyncGenerator<LiveEvent>;
}
export interface FaceLibrary { libraryId?: string; faceLibType?: 'blackFD' | 'staticFD' }
export type FaceImage = Uint8Array | { type: 'url'; url: string; fetchBy?: 'device' | 'sdk' }
  | { type: 'file'; path: string } | { type: 'base64'; data: string };
export interface FaceInput extends FaceLibrary, RequestOptions {
  employeeNo: string; image: FaceImage; metadata?: JsonObject;
}
export interface FaceSearch extends FaceLibrary, SearchOptions { employeeNo?: string }
export interface FaceResource {
  set(options: FaceInput): Promise<IsapiResponse>;
  setMany(faces: Array<Omit<FaceInput, 'signal'>>, options?: BatchOptions): Promise<BatchResult>;
  deleteMany(employeeNos: string[], options?: BatchDeleteOptions & FaceLibrary): Promise<BatchResult>;
  create(options: FaceInput): Promise<IsapiResponse>;
  search(options?: FaceSearch): Promise<Page<JsonObject>>;
  iterate(options?: FaceSearch & IterateOptions): AsyncGenerator<JsonObject>;
  capabilities(options?: RequestOptions): Promise<IsapiResponse>;
  delete(employeeNo: string, options?: FaceLibrary & RequestOptions): Promise<IsapiResponse>;
}
export type ImageSource = string | Uint8Array | EventImage;
export interface ImageOptions extends RequestOptions { allowExternal?: boolean }
export interface ImageFileOptions extends ImageOptions { as: 'file'; filePath: string; overwrite?: boolean }
export interface ImageResource {
  download(source: ImageSource, options?: ImageOptions & { as?: 'buffer' }): Promise<Buffer>;
  download(source: ImageSource, options: ImageOptions & { as: 'base64' }): Promise<string>;
  download(source: ImageSource, options: ImageFileOptions): Promise<string>;
}
export type TimeConfig = { timeMode: 'manual'; localTime: string; timeZone?: string }
  | { timeMode: 'NTP'; localTime?: string; timeZone?: string };
export type NtpServerConfig = { portNo?: number; synchronizeInterval?: number } & (
  { addressingFormatType: 'hostname'; hostName: string; ipAddress?: never; ipv6Address?: never }
  | { addressingFormatType: 'ipaddress'; ipAddress: string; ipv6Address?: never; hostName?: never }
  | { addressingFormatType: 'ipaddress'; ipv6Address: string; ipAddress?: never; hostName?: never }
);
export interface DeviceResource {
  getInfo(options?: RequestOptions): Promise<IsapiResponse>;
  getTime(options?: RequestOptions): Promise<IsapiResponse>;
  setTime(config: TimeConfig, options?: RequestOptions): Promise<IsapiResponse>;
  getNtpServers(options?: RequestOptions): Promise<IsapiResponse>;
  getNtpServer(id?: string, options?: RequestOptions): Promise<IsapiResponse>;
  setNtpServer(id: string, config: NtpServerConfig, options?: RequestOptions): Promise<IsapiResponse>;
  /** Replaces the complete NTP server list. Does not change timeMode. */
  setNtpServers(servers: Array<NtpServerConfig & { id: string }>, options?: RequestOptions): Promise<IsapiResponse>;
  capabilities(options?: RequestOptions & { resource?: 'system' | 'accessControl' }): Promise<IsapiResponse>;
}
export interface DoorResource {
  getStatus(options?: RequestOptions): Promise<IsapiResponse>;
  capabilities(options?: RequestOptions): Promise<IsapiResponse>;
  control(id: number, command: 'open' | 'close' | 'alwaysOpen' | 'alwaysClose', options?: RequestOptions): Promise<IsapiResponse>;
  open(id?: number, options?: RequestOptions): Promise<IsapiResponse>;
  close(id?: number, options?: RequestOptions): Promise<IsapiResponse>;
}
export class HikvisionClient {
  constructor(options: ClientOptions);
  readonly baseUrl: string; readonly maxImageBytes: number;
  readonly device: DeviceResource; readonly users: UserResource; readonly cards: CardResource;
  readonly faces: FaceResource; readonly doors: DoorResource; readonly events: EventResource; readonly images: ImageResource;
  request(options: RawRequest & { responseType: 'buffer' }): Promise<IsapiResponse<Buffer>>;
  request<T = unknown>(options: RawRequest): Promise<IsapiResponse<T>>;
  downloadBytes(path: string, options?: ImageOptions & { maxBytes?: number }): Promise<IsapiResponse<Buffer>>;
  stream(options?: RequestOptions & { path?: string; idleTimeout?: number }): AsyncGenerator<
    { headers: Record<string, string | string[] | undefined>; chunk?: never } | { chunk: Buffer; headers?: never }>;
}
export class HikvisionError extends Error {
  constructor(code: string, message: string, details?: JsonObject);
  code: string; deviceStatus?: number; deviceErrorCode?: string | number; subStatusCode?: string;
  response?: IsapiResponse; outcome?: 'unknown';
}
export function parseXml(text: string): JsonObject;
