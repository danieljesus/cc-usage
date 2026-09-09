#!/usr/bin/env node
/**
 * Entry point. The only job of this file is to pin NODE_ENV before React is
 * loaded — everything else lives in main.tsx.
 *
 * react / react-reconciler pick their build at require() time from
 * process.env.NODE_ENV: anything other than 'production' loads the
 * development build. Since React 19.2 that build emits a
 * performance.measure() per component render for the DevTools performance
 * tracks, and Node keeps every entry in a global buffer with no consumer.
 * cc-usage re-renders every second, so measured on a real run that's ~60
 * entries/s — the 1,000,000-entry cap (and Node's
 * MaxPerformanceEntryBufferExceededWarning) lands after ~4.5 h, growing
 * memory the whole time.
 *
 * A dynamic import is required: a static `import { render } from 'ink'`
 * would be hoisted above the assignment and load React first.
 */
process.env.NODE_ENV ??= 'production';

await import('./main.js');
