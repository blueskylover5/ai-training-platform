/*
 * CON-05: which chat channels the contact section shows. A channel appears only once it is set in
 * `contactConfig` and the value has the right shape; otherwise it stays hidden.
 */

export interface ChannelSettings {
  telegramUrl: string | null;
  discord: {
    username: string | null;
    userId: string | null;
  };
}

export interface ContactChannels {
  telegram: { href: string } | null;
  /** Discord has no link that opens a chat from a username, so the username is shown for copying. */
  discord: { username: string; profileUrl: string | null } | null;
}

/** A public username (5 to 32 characters) or an invite link (`+code` or `joinchat/code`). */
const telegramLink = /^https:\/\/t\.me\/(?:[A-Za-z0-9_]{5,32}|\+[A-Za-z0-9_-]+|joinchat\/[A-Za-z0-9_-]+)$/;
/** Discord usernames: 2 to 32 lowercase letters, digits, underscores and full stops. */
const discordUsername = /^[a-z0-9_.]{2,32}$/;
/** Discord user IDs are numeric (17 to 20 digits). */
const discordUserId = /^\d{17,20}$/;

export function contactChannels(settings: ChannelSettings): ContactChannels {
  const telegramUrl = settings.telegramUrl?.trim() ?? "";
  const username = settings.discord.username?.trim() ?? "";
  const userId = settings.discord.userId?.trim() ?? "";
  return {
    telegram: telegramLink.test(telegramUrl) ? { href: telegramUrl } : null,
    discord: discordUsername.test(username)
      ? { username, profileUrl: discordUserId.test(userId) ? `https://discord.com/users/${userId}` : null }
      : null,
  };
}
