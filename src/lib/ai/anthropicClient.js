import Anthropic from '@anthropic-ai/sdk';

export function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY env var');
  }
  return new Anthropic({ apiKey });
}

// Basic completion helper using Claude Sonnet 3.5 (example model id)
export async function completeMessage({ messages, system, maxTokens = 800, temperature = 0.2 }) {
  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: maxTokens,
    temperature,
    messages,
    system,
  });
  return response;
}

export async function simplePrompt(prompt) {
  const res = await completeMessage({ messages: [{ role: 'user', content: prompt }] });
  // Anthropic returns content as an array of blocks; concatenate text blocks.
  const text = res.content.map(b => b.text || '').join('');
  return { raw: res, text };
}

// Streaming helper: returns the underlying SDK stream so caller can wire events.
export async function streamMessage({ prompt, maxTokens = 800, temperature = 0.2 }) {
  const client = getClient();
  const stream = await client.messages.stream({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  });
  return stream;
}
