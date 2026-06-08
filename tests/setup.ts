import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Globals are off (tests import from 'vitest' explicitly), so RTL's auto-cleanup
// doesn't register on its own — unmount after each test to keep the DOM isolated.
afterEach(cleanup);
