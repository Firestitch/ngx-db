import { defineConfig } from 'vitest/config';


// The tests target the framework-free core (operators, storage, classes) directly
// rather than src/public.api.ts, which pulls in Angular components and would drag
// the whole framework into a plain node test run.
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/*.spec.ts'],
    // Scratch/probe specs live in tests/tmp and must not join the suite.
    exclude: ['tests/tmp/**'],
  },
});
