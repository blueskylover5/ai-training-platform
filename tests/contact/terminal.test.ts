import { describe, expect, it } from "vitest";
import { safeForTerminal } from "../../src/contact/terminal";

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
const REPLACEMENT = String.fromCharCode(0xfffd);

describe("safeForTerminal (contact:list)", () => {
  it("keeps ordinary text, line breaks and tabs", () => {
    expect(safeForTerminal("Hello,\nI need help.\tThanks — Sam")).toBe("Hello,\nI need help.\tThanks — Sam");
    expect(safeForTerminal("Line one\r\nLine two")).toBe("Line one\nLine two");
  });

  it("neutralises escape sequences that clear the screen, add links or set the clipboard", () => {
    const clear = `${ESC}[2J${ESC}[H`;
    const link = `${ESC}]8;;https://evil.example${BEL}click${ESC}]8;;${BEL}`;
    const clipboard = `${ESC}]52;c;ZXZpbA==${BEL}`;
    for (const attack of [clear, link, clipboard]) {
      const shown = safeForTerminal(attack);
      expect(shown).not.toContain(ESC);
      expect(shown).not.toContain(BEL);
      expect(shown).toContain(REPLACEMENT);
    }
  });

  it("neutralises C1 controls and direction overrides", () => {
    const csi = String.fromCharCode(0x9b);
    const rightToLeft = String.fromCharCode(0x202e);
    const isolate = String.fromCharCode(0x2066);
    expect(safeForTerminal(`a${csi}b${rightToLeft}c${isolate}d`)).toBe(`a${REPLACEMENT}b${REPLACEMENT}c${REPLACEMENT}d`);
  });
});
