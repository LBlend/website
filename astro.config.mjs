// @ts-check
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

import node from "@astrojs/node";

/** @param {string} [defaultValue] */
const secret = (defaultValue) =>
  defaultValue === undefined
    ? envField.string({ context: "server", access: "secret", optional: true })
    : envField.string({ context: "server", access: "secret", default: defaultValue });

// https://astro.build/config
export default defineConfig({
  site: "https://furumo.eu",
  output: "server",
  integrations: [mdx(), sitemap()],

  env: {
    schema: {
      ANILIST_URL: secret("https://graphql.anilist.co/"),
      ANILIST_USERNAME: secret(),
      DISCORD_BOT_TOKEN: secret(),
      DISCORD_GUILD_ID: secret(),
      DISCORD_BLOG_CHANNEL_ID: secret(),
      IMMICH_URL: secret("https://photos.furumo.eu/"),
      IMMICH_API_KEY: secret(),
      LASTFM_URL: secret("https://ws.audioscrobbler.com/2.0/"),
      LASTFM_API_KEY: secret(),
      LASTFM_USERNAME: secret(),
      OSU_URL: secret("https://osu.ppy.sh/"),
      OSU_CLIENT_ID: secret(),
      OSU_CLIENT_SECRET: secret(),
      OSU_USER_ID: secret(),
      SIMKL_URL: secret("https://api.simkl.com/"),
      SIMKL_CLIENT_ID: secret(),
      SIMKL_USER_ID: secret(),
      STEAM_URL: secret("https://api.steampowered.com/"),
      STEAM_API_KEY: secret(),
      STEAM_USER_ID: secret(),
      WAKATIME_URL: secret("https://api.wakatime.com/api/v1/"),
      WAKATIME_ACCESS_TOKEN: secret(),
      WAKATIME_USERNAME: secret(),
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: node({
    mode: "standalone",
  }),
});
