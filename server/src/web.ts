// Helpers HTTP compartidos por index.ts y los módulos de rutas (practice, progress, market, leagues).
import type { IncomingMessage, ServerResponse } from 'node:http'

export async function readJson<T>(req: IncomingMessage): Promise<T> {
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > 200_000) throw new Error('body demasiado grande') }
  return JSON.parse(raw || '{}') as T
}

export function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}
