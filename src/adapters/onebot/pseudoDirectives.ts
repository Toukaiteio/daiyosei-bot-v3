export type PseudoDirective = {
  name: string;
  value: string;
  params: Record<string, string>;
  raw: string;
};

const PSEUDO_DIRECTIVE_RE = /\[\[(browser_goto|browser_search|browser_read_text|browser_click|browser_type|browser_evaluate|browser_screenshot_to_sandbox|inspect_recent_image)(?::([^\]]*))?\]\]/gi;

export function extractPseudoDirectives(text: string): PseudoDirective[] {
  const directives: PseudoDirective[] = [];

  for (const match of text.matchAll(PSEUDO_DIRECTIVE_RE)) {
    const parsed = parseDirectiveBody(String(match[2] ?? ''));
    directives.push({
      name: String(match[1] ?? '').trim(),
      value: parsed.value,
      params: parsed.params,
      raw: match[0],
    });
  }

  return directives;
}

function parseDirectiveBody(body: string) {
  const segments = body
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const value = segments.shift() ?? '';
  const params: Record<string, string> = {};

  for (const segment of segments) {
    const separatorIndex = segment.indexOf(':') >= 0 ? segment.indexOf(':') : segment.indexOf('=');
    if (separatorIndex <= 0) {
      params[segment.toLowerCase()] = 'true';
      continue;
    }

    const key = segment.slice(0, separatorIndex).trim().toLowerCase();
    const val = segment.slice(separatorIndex + 1).trim();
    if (key) {
      params[key] = val;
    }
  }

  return { value, params };
}
