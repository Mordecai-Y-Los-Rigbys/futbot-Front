import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Sin `globals: true`, RTL no se limpia solo entre tests.
afterEach(cleanup);