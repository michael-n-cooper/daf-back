import { defineConfig } from 'astro/config';

import node from "@astrojs/node";

// https://astro.build/config
export default defineConfig({
  server: {
    port: 4322,
    host: true
  },
  site: 'https://michael-n-cooper.github.io',
  base: '/',
  output: "server",
  adapter: node({
    mode: "standalone"
  })
});