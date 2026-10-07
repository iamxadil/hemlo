// The waiting-room screens' live line: one small Durable Object per clinic holds the open connections of its TVs.
// When an appointment changes, the API pings the clinic's hub and every TV fetches the queue at once (a call reaches the
// waiting room in about a second, not "within 12 seconds"). Connections hibernate while idle: a TV left on all day costs
// nothing between changes, and its keep-alive "ping" is answered without waking the hub.
import { DurableObject } from 'cloudflare:workers';

export class ScreenHub extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req: Request) {
    if (new URL(req.url).pathname === '/changed') {
      for (const ws of this.ctx.getWebSockets()) { try { ws.send('changed'); } catch { /* a closing socket */ } }
      return new Response(null, { status: 204 });
    }
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('expected a websocket', { status: 426 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketClose(ws: WebSocket, code: number) { try { ws.close(code); } catch { /* already closed */ } }
  async webSocketError(ws: WebSocket) { try { ws.close(1011); } catch { /* already closed */ } }
}
