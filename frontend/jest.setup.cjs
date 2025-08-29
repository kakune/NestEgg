require('@testing-library/jest-dom');
require('whatwg-fetch');

// Polyfill TextEncoder/TextDecoder for Node.js
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Polyfill TransformStream for MSW
global.TransformStream = class {
  constructor() {
    this.readable = {
      getReader: () => ({
        read: () => Promise.resolve({ done: true }),
        releaseLock: () => {},
      }),
    };
    this.writable = {
      getWriter: () => ({
        write: () => Promise.resolve(),
        close: () => Promise.resolve(),
        releaseLock: () => {},
      }),
    };
  }
};

// Polyfill BroadcastChannel for MSW
global.BroadcastChannel = class {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
  }
  postMessage() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
};

// Mock Next.js router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  reload: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
  route: '/',
  events: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock localStorage that actually stores values
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Also set global localStorage for compatibility
global.localStorage = localStorageMock;

// Mock sessionStorage that actually stores values
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Also set global sessionStorage for compatibility
global.sessionStorage = sessionStorageMock;

// Mock window.location methods only if they don't exist
if (!window.location.assign || typeof window.location.assign !== 'function') {
  window.location.assign = jest.fn();
}
if (!window.location.replace || typeof window.location.replace !== 'function') {
  window.location.replace = jest.fn();
}
if (!window.location.reload || typeof window.location.reload !== 'function') {
  window.location.reload = jest.fn();
}

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Clear storage mock call histories
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
  
  // Clear actual stored data
  localStorageMock.clear();
  sessionStorageMock.clear();
});