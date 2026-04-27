import type { BotMessage, OneBotInboundEvent, OneBotMessageSegment } from './types.js';

export function mapOneBotEvent(event: OneBotInboundEvent): BotMessage | undefined {
  if (event.post_type !== 'message' || !event.message_type) {
    return undefined;
  }

  const segments = normalizeSegments(event.message);

  return {
    id: event.message_id === undefined ? undefined : String(event.message_id),
    type: event.message_type,
    selfId: event.self_id === undefined ? undefined : String(event.self_id),
    userId: event.user_id === undefined ? undefined : String(event.user_id),
    groupId: event.group_id === undefined ? undefined : String(event.group_id),
    text: extractText(segments),
    segments,
    raw: event,
  };
}

function normalizeSegments(message: OneBotInboundEvent['message']): OneBotMessageSegment[] {
  if (!message) {
    return [];
  }

  if (typeof message === 'string') {
    return parseCqMessage(message);
  }

  return message;
}

function extractText(segments: OneBotMessageSegment[]) {
  return segments.map(segmentToText).join('').trim();
}

function segmentToText(segment: OneBotMessageSegment) {
  if (segment.type === 'text') {
    return String(segment.data.text ?? '');
  }

  if (segment.type === 'image') {
    const url = readString(segment.data.url);
    const file = readString(segment.data.file);
    const summary = readString(segment.data.summary);
    const attrs = [
      summary ? `summary=${JSON.stringify(summary)}` : undefined,
      file ? `file=${JSON.stringify(file)}` : undefined,
      url ? `url=${JSON.stringify(url)}` : undefined,
    ].filter(Boolean);
    return `[image${attrs.length > 0 ? ` ${attrs.join(' ')}` : ''}]`;
  }

  if (segment.type === 'reply') {
    const id = readString(segment.data.id);
    return id ? `[reply id=${JSON.stringify(id)}]` : '[reply]';
  }

  return `[${segment.type}]`;
}

function parseCqMessage(message: string): OneBotMessageSegment[] {
  const segments: OneBotMessageSegment[] = [];
  const regex = /\[CQ:([^,\]]+)((?:,[^\]]*)?)\]/g;
  let lastIndex = 0;

  for (const match of message.matchAll(regex)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', data: { text: decodeCqValue(message.slice(lastIndex, index)) } });
    }

    segments.push({
      type: match[1],
      data: parseCqData(match[2] ?? ''),
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < message.length) {
    segments.push({ type: 'text', data: { text: decodeCqValue(message.slice(lastIndex)) } });
  }

  return segments.length > 0 ? segments : [{ type: 'text', data: { text: decodeCqValue(message) } }];
}

function parseCqData(input: string) {
  const data: Record<string, string> = {};
  const content = input.startsWith(',') ? input.slice(1) : input;
  if (!content) {
    return data;
  }

  for (const pair of content.split(',')) {
    const separator = pair.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    data[key] = decodeCqValue(value);
  }

  return data;
}

function decodeCqValue(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#44;', ',')
    .replaceAll('&#91;', '[')
    .replaceAll('&#93;', ']')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function readString(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  return value;
}
