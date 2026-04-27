import type { OneBotMessageSegment } from './types.js';
import type { MemeLibrary } from '../../memes/library.js';

export type OutgoingMessageOptions = {
  memeLibrary?: MemeLibrary;
  memesEnabled?: boolean;
  allowedCategories?: string[];
  disabledMemes?: string[];
  replyMessageId?: string;
};

export function textSegment(text: string): OneBotMessageSegment {
  return { type: 'text', data: { text } };
}

export function replySegment(messageId: string): OneBotMessageSegment {
  return { type: 'reply', data: { id: messageId } };
}

const DIRECTIVE_RE = /\[\[(face|emoji|meme|image|pic|reply|quote)(?::([^\]]*))?\]\]/gi;

const EMOJI_ALIASES: Record<string, string> = {
  smile: '😄',
  grin: '😁',
  laugh: '😂',
  wink: '😉',
  love: '😍',
  kiss: '😘',
  heart: '❤️',
  thumbs_up: '👍',
  party: '🎉',
  thinking: '🤔',
  sweat: '😅',
  cry: '😢',
  angry: '😠',
  surprised: '😲',
  ok: '👌',
  proud: '😌',
  sad: '😞',
  sleep: '😴',
  facepalm: '🤦',
};

export function buildOutgoingMessageSegments(
  output: string,
  options: OutgoingMessageOptions = {},
): OneBotMessageSegment[] {
  const segments: OneBotMessageSegment[] = [];
  let lastIndex = 0;

  for (const match of output.matchAll(DIRECTIVE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push(textSegment(output.slice(lastIndex, index)));
    }

    const kind = match[1].toLowerCase();
    const value = (match[2] ?? '').trim();
    const parsed = parseDirective(kind, value, match[0], options);
    segments.push(parsed);
    lastIndex = index + match[0].length;
  }

  if (lastIndex < output.length) {
    segments.push(textSegment(output.slice(lastIndex)));
  }

  const cleaned = segments.filter((segment) => {
    if (segment.type !== 'text') {
      return true;
    }

    return String(segment.data.text ?? '').length > 0;
  });

  return cleaned.length > 0 ? cleaned : [textSegment(output)];
}

function parseDirective(
  kind: string,
  value: string,
  raw: string,
  options: OutgoingMessageOptions,
): OneBotMessageSegment {
  if (kind === 'face') {
    const id = Number(value);
    if (Number.isInteger(id) && id >= 0) {
      return { type: 'face', data: { id } };
    }
    return textSegment(raw);
  }

  if (kind === 'emoji') {
    return textSegment(resolveEmojiValue(value));
  }

  if (kind === 'meme') {
    if (options.memesEnabled === false || !options.memeLibrary) {
      return textSegment(raw);
    }

    const meme = options.memeLibrary.pickRandom({
      category: value,
      allowedCategories: options.allowedCategories,
      disabledMemes: options.disabledMemes,
    });
    if (!meme) {
      return textSegment(raw);
    }

    return {
      type: 'image',
      data: {
        file: meme.absolutePath,
        type: meme.mimeType,
      },
    };
  }

  if (kind === 'image' || kind === 'pic') {
    const source = value.trim();
    if (!source) {
      return textSegment(raw);
    }

    return imageSegment(source);
  }

  if (kind === 'reply' || kind === 'quote') {
    const messageId = value.trim() || options.replyMessageId;
    if (!messageId) {
      return textSegment(raw);
    }

    return replySegment(messageId);
  }

  return textSegment(raw);
}

function resolveEmojiValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return EMOJI_ALIASES[normalized] ?? value;
}

function imageSegment(source: string): OneBotMessageSegment {
  const isRemote = /^https?:\/\//i.test(source);
  return {
    type: 'image',
    data: isRemote ? { file: source, url: source } : { file: source },
  };
}
