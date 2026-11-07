import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sin `globals: true`, RTL no se limpia solo entre tests.
afterEach(cleanup);

// jsdom no implementa las medidas de Range que CodeMirror usa al renderizar.
if (typeof Range !== 'undefined') {
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* () {},
  });
  Range.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {},
  });
}