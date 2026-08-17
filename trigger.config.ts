import { defineConfig } from '@trigger.dev/sdk'

export default defineConfig({
  project: 'proj_rhdfctguthbwtcjgsvyx',
  dirs: ['./trigger'],
  runtime: 'node-24',
  maxDuration: 600,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 5,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    external: ['@firecrawl/anydoc', 'jsdom'],
  },
})
