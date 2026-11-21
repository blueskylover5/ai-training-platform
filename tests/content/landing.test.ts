import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { landingConfig } from "../../src/config";
import { challenges, heroBackgrounds, heroPlatformNames, platforms } from "../../src/content/landing";

/** An image path must be under /images and the file must be in /public, so a typo never ships a broken picture. */
function expectImage(src: string | null) {
  if (src === null) return;
  expect(src).toMatch(/^\/images\/[a-z0-9/_-]+\.(jpe?g|png|webp|avif|svg)$/);
  expect(existsSync(new URL(`../../public${src}`, import.meta.url)), `missing file public${src}`).toBe(true);
}

describe("home page content (19 November 2026)", () => {
  it("has several hero background photos, each with a stand-in panel", () => {
    expect(heroBackgrounds.length).toBeGreaterThanOrEqual(2);
    for (const background of heroBackgrounds) {
      expect(background.panel.trim()).not.toBe("");
      expectImage(background.src);
    }
    const photos = heroBackgrounds.flatMap((b) => (b.src ? [b.src] : []));
    expect(new Set(photos).size).toBe(photos.length);
  });

  it("gives every challenge a title, a line and a description of its photo", () => {
    for (const challenge of challenges) {
      expect(challenge.title.trim()).not.toBe("");
      expect(challenge.text.trim()).not.toBe("");
      expect(challenge.alt.trim().length).toBeGreaterThan(10);
      expectImage(challenge.src);
    }
    expect(new Set(challenges.map((c) => c.key)).size).toBe(challenges.length);
  });

  it("lists each platform once, with its logo file when there is one", () => {
    expect(new Set(platforms.map((p) => p.name.toLowerCase())).size).toBe(platforms.length);
    for (const platform of platforms) expectImage(platform.logo);
  });

  it("names hero platforms from the platform list, so each has its logo", () => {
    expect(heroPlatformNames).toEqual(["AfterQuery", "Outlier", "Handshake", "DataAnnotation"]);
    for (const name of heroPlatformNames) {
      const platform = platforms.find((p) => p.name === name);
      expect(platform, `${name} is not in the platform list`).toBeDefined();
      expect(platform?.logo).not.toBeNull();
    }
  });

  it("changes the hero background slowly", () => {
    expect(landingConfig.heroBackgroundIntervalMs).toBeGreaterThanOrEqual(5_000);
  });
});
