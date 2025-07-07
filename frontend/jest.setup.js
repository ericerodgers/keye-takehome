import '@testing-library/jest-dom'

// Polyfill ResizeObserver for tests
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};