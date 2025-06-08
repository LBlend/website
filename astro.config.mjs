// @ts-check
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  site: "https://furumo.eu",
  integrations: [mdx(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: node({
    mode: "standalone",
  }),
});
