/**
 * Higgs Realtime smoke test.
 *
 * Opens a real upstream session with the server-side key, sends one text turn,
 * and prints the event types that come back. It uses no microphone and no
 * speaker, so it separates "is the credential and endpoint working?" from
 * "is the phone audio stack working?".
 *
 * Run: BOSON_API_KEY=... npm run probe --workspace @alfie/agent
 */

import WebSocket from 'ws';
import { loadConfig } from '../config.js';
import { explainClose } from './closeCodes.js';
import { buildInstructions } from './prompt.js';

const config = loadConfig();

if (!config.bosonApiKey) {
  process.stderr.write(
    'BOSON_API_KEY is not set. Export it (or provide it via InstaCloud secrets) and run again.\n',
  );
  process.exit(2);
}

const url = new URL(config.bosonRealtimeUrl);
url.searchParams.set('model', config.bosonModel);

// Identity of the credential and endpoint under test. The fingerprint is a
// non-reversible SHA-256 prefix, so it can be compared against the operator's
// own key without the value being printed.
process.stdout.write(
  [
    `endpoint:    ${url.origin}${url.pathname}?model=${config.bosonModel}`,
    `key source:  ${config.keySource}`,
    `key length:  ${config.bosonKeyLength}`,
    `key print:   ${config.bosonKeyFingerprint ?? '(none)'}`,
    `key prefix:  ${config.bosonApiKey?.startsWith('bai-') ? 'bai- ok' : 'NOT a bai- key'}`,
    '',
  ].join('\n'),
);

const socket = new WebSocket(url, {
  headers: { Authorization: `Bearer ${config.bosonApiKey}` },
});

const seen: string[] = [];
let audioBytes = 0;
let transcript = '';
let settled = false;

function finish(code: number, note: string): void {
  if (settled) return;
  settled = true;
  process.stdout.write(`\n${note}\n`);
  process.stdout.write(`events: ${seen.length}\n`);
  process.stdout.write(
    `distinct: ${[...new Set(seen)].join(', ') || '(none)'}\n`,
  );
  process.stdout.write(`audio bytes: ${audioBytes}\n`);
  if (transcript) process.stdout.write(`spoken reply: ${transcript}\n`);
  try {
    socket.close();
  } catch {
    /* already closed */
  }
  process.exit(code);
}

const timeout = setTimeout(
  () => finish(1, 'Timed out after 30s without a completed response.'),
  30_000,
);
timeout.unref();

socket.on('open', () => {
  process.stdout.write(`Connected to ${url.origin}${url.pathname}\n`);
  socket.send(
    JSON.stringify({
      type: 'session.update',
      session: {
        model: config.bosonModel,
        instructions: buildInstructions({ mode: 'Discover' }),
        audio: {
          input: { turn_detection: null },
          output: { format: { type: 'audio/pcm', rate: 24000 } },
        },
        output_modalities: ['audio'],
      },
    }),
  );
  socket.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Say one short sentence.' }],
      },
    }),
  );
  socket.send(JSON.stringify({ type: 'response.create' }));
});

socket.on('message', (data) => {
  let event: { type?: unknown; delta?: unknown; transcript?: unknown };
  try {
    event = JSON.parse(data.toString()) as typeof event;
  } catch {
    return;
  }
  if (typeof event.type !== 'string') return;
  seen.push(event.type);
  if (
    event.type === 'response.output_audio.delta' &&
    typeof event.delta === 'string'
  ) {
    audioBytes += Math.floor((event.delta.length * 3) / 4);
  }
  if (
    event.type === 'response.output_audio_transcript.done' &&
    typeof event.transcript === 'string'
  ) {
    transcript = event.transcript;
  }
  if (event.type === 'error') {
    process.stderr.write(`Higgs reported an error: ${JSON.stringify(event)}\n`);
    finish(1, 'Higgs Realtime returned an error event.');
  }
  if (event.type === 'response.done') {
    finish(
      audioBytes > 0 ? 0 : 1,
      audioBytes > 0
        ? 'OK: speech-to-speech path works.'
        : 'No audio was returned.',
    );
  }
});

socket.on('unexpected-response', (_request, response) => {
  finish(
    1,
    `Handshake rejected with HTTP ${response.statusCode}. A 401/403 means the API key is wrong or has no credit.`,
  );
});

/**
 * Critical: Boson completes the WebSocket handshake and only THEN closes the
 * socket with a code. Without this handler the probe appears to "connect
 * successfully" and then silently times out, which reads as success. Code 3000
 * in particular means the API key was rejected.
 */
socket.on('close', (code, reason) => {
  const reasonText = reason?.toString() ?? '';
  const explained = explainClose(code, reasonText);
  finish(
    code === 1000 && audioBytes > 0 ? 0 : 1,
    `Socket closed before a response completed. ${explained.message}`,
  );
});

socket.on('error', () => {
  finish(1, 'Could not reach the Higgs Realtime endpoint.');
});
