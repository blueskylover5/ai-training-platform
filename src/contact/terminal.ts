/*
 * Text from the public contact form, made safe to print in a terminal (`npm run contact:list`).
 * Escape sequences could otherwise clear or rewrite the screen, add fake links (OSC 8) or set the
 * clipboard (OSC 52), and direction marks could disguise what a message says.
 */

// Control characters except tab and line feed, C1 controls, and bidirectional marks and overrides.
const UNSAFE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/** Keeps line breaks and tabs; shows every other control character as U+FFFD (the replacement character). */
export function safeForTerminal(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(UNSAFE, "\uFFFD");
}
