import '@testing-library/jest-dom';

// Polyfill for Next.js server components (Request, Response, Headers, etc.)
// These are needed for testing API routes
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Request/Response for Next.js API routes
class MockRequest {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : input?.url || '';
    this.method = init.method || 'GET';
    this._headers = new Map(Object.entries(init.headers || {}));
    this._body = init.body;
  }
  get headers() {
    return {
      get: (name) => this._headers.get(name.toLowerCase()),
    };
  }
  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }
}

class MockResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || '';
    this._headers = new Map(Object.entries(init.headers || {}));
  }
  get headers() {
    return {
      get: (name) => this._headers.get(name.toLowerCase()),
      set: (name, value) => this._headers.set(name.toLowerCase(), value),
    };
  }
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
}

global.Request = MockRequest;
global.Response = MockResponse;
global.Headers = Map;

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }) => children,
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(),
  })),
}));
