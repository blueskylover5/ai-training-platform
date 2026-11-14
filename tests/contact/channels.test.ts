import { describe, expect, it } from "vitest";
import { contactChannels, type ChannelSettings } from "../../src/contact/channels";
import { contactConfig } from "../../src/config";

const none: ChannelSettings = { telegramUrl: null, discord: { username: null, userId: null } };
const withTelegram = (telegramUrl: string | null): ChannelSettings => ({ ...none, telegramUrl });
const withDiscord = (username: string | null, userId: string | null = null): ChannelSettings => ({
  ...none,
  discord: { username, userId },
});

describe("contactChannels (CON-05)", () => {
  it("hides every channel that is not set", () => {
    expect(contactChannels(none)).toEqual({ telegram: null, discord: null });
    expect(contactChannels({ telegramUrl: "  ", discord: { username: "", userId: "" } })).toEqual({
      telegram: null,
      discord: null,
    });
  });

  it("shows Telegram for a public username or an invite link", () => {
    for (const href of [
      "https://t.me/happyman01110",
      "https://t.me/+AbCdEf123_-x",
      "https://t.me/joinchat/AbCdEf123",
    ]) {
      expect(contactChannels(withTelegram(href)).telegram).toEqual({ href });
    }
  });

  it("hides Telegram links that are not t.me over https", () => {
    for (const href of [
      "http://t.me/happyman01110",
      "https://t.me.example.com/happyman01110",
      "https://example.com/?u=https://t.me/x",
      "javascript:alert(1)",
      "https://t.me/abc",
      "@happyman01110",
    ]) {
      expect(contactChannels(withTelegram(href)).telegram).toBeNull();
    }
  });

  it("shows the Discord username, with a profile link only for a numeric user ID", () => {
    expect(contactChannels(withDiscord("sina2949")).discord).toEqual({ username: "sina2949", profileUrl: null });
    expect(contactChannels(withDiscord("sina2949", "123456789012345678")).discord).toEqual({
      username: "sina2949",
      profileUrl: "https://discord.com/users/123456789012345678",
    });
    expect(contactChannels(withDiscord("sina2949", "sina2949")).discord?.profileUrl).toBeNull();
  });

  it("hides Discord names that are not valid usernames", () => {
    for (const username of ["Sina2949", "sina 2949", "s", "a".repeat(33), "<b>sina</b>"]) {
      expect(contactChannels(withDiscord(username)).discord).toBeNull();
    }
  });

  it("shows both configured channels (exception to SEC-03 approved in #3)", () => {
    const channels = contactChannels(contactConfig);
    expect(channels.telegram).toEqual({ href: "https://t.me/happyman01110" });
    expect(channels.discord?.username).toBe("sina2949");
  });
});
