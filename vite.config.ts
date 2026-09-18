import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs, so the build runs from any path it is served at:
  // a domain root, or a folder such as /lab/hindsight/ on another site.
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
