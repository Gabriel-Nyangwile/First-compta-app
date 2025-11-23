import { simplePrompt, streamMessage } from '@/lib/ai/anthropicClient';

const encoder = new TextEncoder();

function sseData(obj) {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

function sseEvent(event, obj) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { prompt, stream = true, maxTokens, temperature } = body;
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Missing prompt' }), { status: 400 });
    }

    // Non-streaming fallback
    if (!stream) {
      const result = await simplePrompt(prompt);
      return new Response(JSON.stringify({ ok: true, text: result.text, streamed: false }), { status: 200 });
    }

    // Streaming via Server-Sent Events (SSE)
    const sdkStream = await streamMessage({ prompt, maxTokens, temperature });

    const readable = new ReadableStream({
      start(controller) {
        sdkStream.on('text', (chunk) => {
          controller.enqueue(sseData({ type: 'text', chunk }));
        });
        sdkStream.on('error', (err) => {
          controller.enqueue(sseEvent('error', { message: err.message }));
          controller.close();
        });
        sdkStream.on('end', () => {
          controller.enqueue(sseEvent('end', {}));
          controller.close();
        });
      },
      cancel() {
        try { sdkStream.abort && sdkStream.abort(); } catch (_) {}
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
}
