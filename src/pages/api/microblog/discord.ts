export const prerender = false;

// This file is purely vibe coded and needs to be cleaned up.
// It works for now but due to a persisteance issue with the Discord API, it may not work in the future.
// See issue #3 on GitHub
// I just want to commit this for now

import type { APIRoute } from "astro";

interface DiscordAttachment {
  filename: string | null;
  url: string;
  content_type: string;
}

interface DiscordAuthor {
  id: string;
  username: string;
  global_name: string;
  avatar: string | null;
}

interface DiscordEmoji {
  id: string | null;
  name: string;
  animated: boolean;
  url: string | null;
}

interface DiscordMember {
  user: {
    id: string;
  };
  roles: string[];
}

interface DiscordMessage {
  id: string;
  content: string;
  timestamp: string;
  author: DiscordAuthor;
  attachments: DiscordAttachment[];
  emojis: DiscordEmoji[];
}

interface DiscordRole {
  id: string;
  color: number;
}

export interface MicroblogMessage {
  id: string;
  content: string;
  timestamp: string;
  author: {
    username: string;
    globalName: string;
    avatarUrl: string;
    color: string | null;
  };
  attachments: {
    url: string;
    filename: string;
    contentType: string;
  }[];
  emojis: DiscordEmoji[];
}

function isDiscordMember(member: unknown): member is DiscordMember {
  return (
    typeof member === "object" && member !== null && "roles" in member && Array.isArray((member as DiscordMember).roles)
  );
}

function isDiscordRole(role: unknown): role is DiscordRole {
  return (
    typeof role === "object" &&
    role !== null &&
    "id" in role &&
    "color" in role &&
    typeof (role as DiscordRole).color === "number"
  );
}

export async function getDiscordMessages(): Promise<MicroblogMessage[]> {
  try {
    const discordToken = import.meta.env.DISCORD_BOT_TOKEN;
    if (!discordToken) {
      throw new Error("Discord bot token not configured");
    }

    const guildId = import.meta.env.DISCORD_GUILD_ID;
    const channelId = import.meta.env.DISCORD_BLOG_CHANNEL_ID;

    // Fetch messages
    const messagesResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      headers: {
        Authorization: `Bot ${discordToken}`,
      },
      cache: "force-cache",
    });

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      throw new Error(`Discord API error (${messagesResponse.status}): ${errorText}`);
    }

    const messages = await messagesResponse.json();

    // Fetch guild roles
    const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: {
        Authorization: `Bot ${discordToken}`,
      },
      cache: "force-cache",
    });

    if (!rolesResponse.ok) {
      const errorText = await rolesResponse.text();
      throw new Error(`Discord API error (${rolesResponse.status}): ${errorText}`);
    }

    const roles = await rolesResponse.json();
    const roleMap = new Map(roles.filter(isDiscordRole).map((role: DiscordRole) => [role.id, role]));

    // Fetch guild members
    const membersResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
      headers: {
        Authorization: `Bot ${discordToken}`,
      },
      cache: "force-cache",
    });

    if (!membersResponse.ok) {
      const errorText = await membersResponse.text();
      throw new Error(`Discord API error (${membersResponse.status}): ${errorText}`);
    }

    const members = await membersResponse.json();
    const memberMap = new Map(members.map((member: DiscordMember) => [member.user.id, member]));

    const formattedMessages: MicroblogMessage[] = messages.map((msg: DiscordMessage) => {
      const avatarUrl = msg.author.avatar
        ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/0.png`;

      // Get member data and role colors
      const member = memberMap.get(msg.author.id);
      let colorHex: string | null = null;

      if (isDiscordMember(member) && member.roles.length > 0) {
        const roleColors = member.roles
          .map((roleId: string) => {
            const role = roleMap.get(roleId);
            return isDiscordRole(role) ? role.color : undefined;
          })
          .filter((color: number | undefined): color is number => typeof color === "number" && color !== 0)
          .sort((a: number, b: number) => b - a);

        if (roleColors.length > 0) {
          colorHex = `#${roleColors[0].toString(16).padStart(6, "0")}`;
        }
      }

      // Extract custom emojis from the message
      const emojiRegex = /<a?:([a-zA-Z0-9_]+):(\d+)>/g;
      const emojis: DiscordEmoji[] = [];
      let match;

      while ((match = emojiRegex.exec(msg.content)) !== null) {
        const isAnimated = match[0].startsWith("<a:");
        const name = match[1];
        const id = match[2];
        const url = `https://cdn.discordapp.com/emojis/${id}.${isAnimated ? "gif" : "png"}`;

        emojis.push({
          id,
          name,
          animated: isAnimated,
          url,
        });
      }

      return {
        id: msg.id,
        content: msg.content,
        timestamp: msg.timestamp,
        author: {
          username: msg.author.username,
          globalName: msg.author.global_name,
          avatarUrl: avatarUrl,
          color: colorHex,
        },
        attachments: msg.attachments.map((attachment) => ({
          url: attachment.url,
          filename: attachment.filename,
          contentType: attachment.content_type,
        })),
        emojis,
      };
    });

    return formattedMessages;
  } catch (error) {
    console.error("Error fetching Discord messages:", error);
    throw error;
  }
}

export const GET: APIRoute = async () => {
  try {
    const formattedMessages = await getDiscordMessages();

    return new Response(JSON.stringify(formattedMessages), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to fetch Discord messages" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
