import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement scrolling; the layout scrolls to anchors and to the top on navigation.
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

afterEach(() => cleanup());
