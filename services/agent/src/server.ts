import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { loadConfig } from './config.js';
import { RealtimeSession } from './realtime/session.js';
import { parseMode } from './realtime/prompt.js';

const config = loadConfig();

function json(
  response: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  response.writeHead(status);
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'GET' && url.pathname === '/health') {
    // Liveness only: does not imply the voice provider is reachable.
    json(response, 200, { status: 'ok', service: 'alfie-agent' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/status') {
    // Readiness for the realtime voice path. Booleans only, never key values.
    json(response, 200, {
      service: 'alfie-agent',
      realtime: {
        provider: 'boson-higgs-realtime',
        model: config.bosonModel,
        endpoint: config.bosonRealtimeUrl,
        credentialConfigured: config.bosonApiKey !== undefined,
        ready: config.bosonApiKey !== undefined,
      },
      limits: { maxSessionMs: config.maxSessionMs },
    });
    return;
  }

  json(response, 404, { error: 'Not found' });
});

const realtimeServer = new WebSocketServer({ noServer: true });

function originAllowed(origin: string | undefined): boolean {
  if (config.allowedOrigins.length === 0) return true;
  // Native iOS/Android WebSocket clients do not send an Origin header, so an
  // absent Origin must stay allowed or the deployed service would reject the
  // mobile app while accepting browsers. The allowlist constrains browsers,
  // which is where Origin is a meaningful signal.
  if (typeof origin !== 'string') return true;
  return config.allowedOrigins.includes(origin);
}

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname !== '/realtime') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  if (!originAllowed(request.headers.origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  if (!config.bosonApiKey) {
    socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    socket.destroy();
    return;
  }
  realtimeServer.handleUpgrade(request, socket, head, (client) => {
    realtimeServer.emit('connection', client, request);
  });
});

realtimeServer.on(
  'connection',
  (client: WebSocket, request: import('node:http').IncomingMessage) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const mode = parseMode(url.searchParams.get('mode')) ?? 'Discover';

    const session = new RealtimeSession(
      {
        config,
        send: (event) => {
          if (client.readyState === client.OPEN)
            client.send(JSON.stringify(event));
        },
        onClose: (summary) => {
          // Counts only. Never transcripts, audio, or coordinates.
          process.stdout.write(
            `${JSON.stringify({
              level: 'info',
              event: 'realtime.session.closed',
              mode,
              reason: summary.reason,
              turns: summary.turns,
              audioChunks: summary.audioChunks,
            })}\n`,
          );
          client.close(1000, summary.reason.slice(0, 100));
        },
      },
      mode,
    );

    client.on('message', (data) => {
      session.handleClientMessage(
        typeof data === 'string' ? data : data.toString(),
      );
    });
    client.on('close', () => session.close('client-closed', 'session ended'));
    client.on('error', () => session.close('client-error', 'connection error'));
  },
);

server.listen(config.port, '0.0.0.0');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close((error) => {
      process.exitCode = error ? 1 : 0;
    });
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
