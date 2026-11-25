import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { createApiApp } from '../../src/server/app.ts';

interface NetlifyEvent {
  httpMethod: string;
  path: string;
  rawUrl?: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
}

interface NetlifyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

const app = createApiApp();

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);

    const normalizedPath = event.path.startsWith('/.netlify/functions/api')
      ? '/api' + event.path.slice('/.netlify/functions/api'.length)
      : event.path;

    const queryPairs = Object.entries(event.queryStringParameters ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    );
    const qs = queryPairs.length
      ? '?' + new URLSearchParams(queryPairs).toString()
      : '';

    req.method = event.httpMethod || 'GET';
    req.url = `${normalizedPath || '/api/health'}${qs}`;

    for (const [key, val] of Object.entries(event.headers ?? {})) {
      if (typeof val === 'string') {
        req.headers[key.toLowerCase()] = val;
      }
    }
    // Disable gzip inside serverless wrapper so Netlify handles response encoding cleanly
    delete req.headers['accept-encoding'];

    if (event.body) {
      const buf = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
      req.push(buf);
    }
    req.push(null);

    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];

    const originalWrite = res.write.bind(res);
    res.write = ((
      chunk: unknown,
      encodingOrCb?: BufferEncoding | ((error?: Error | null) => void),
      cb?: (error?: Error | null) => void
    ) => {
      if (chunk !== undefined && chunk !== null) {
        chunks.push(
          Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(
                String(chunk),
                typeof encodingOrCb === 'string' ? encodingOrCb : 'utf8'
              )
        );
      }
      if (typeof encodingOrCb === 'function') {
        return originalWrite(chunk, encodingOrCb);
      }
      if (encodingOrCb && cb) {
        return originalWrite(chunk, encodingOrCb, cb);
      }
      return true;
    }) as typeof res.write;

    res.end = ((
      chunk?: unknown,
      encodingOrCb?: BufferEncoding | (() => void),
      cb?: () => void
    ) => {
      if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
        chunks.push(
          Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(
                String(chunk),
                typeof encodingOrCb === 'string' ? encodingOrCb : 'utf8'
              )
        );
      }

      const rawHeaders = res.getHeaders();
      const responseHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (v !== undefined) {
          responseHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v);
        }
      }

      if (typeof chunk === 'function') chunk();
      else if (typeof encodingOrCb === 'function') encodingOrCb();
      else if (typeof cb === 'function') cb();

      resolve({
        statusCode: res.statusCode || 200,
        headers: responseHeaders,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      return res;
    }) as typeof res.end;

    res.on('error', reject);
    app(req, res);
  });
};
