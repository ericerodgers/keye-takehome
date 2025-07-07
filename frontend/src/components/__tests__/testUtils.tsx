import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock data for consistent testing
export const mockSpreadsheetData = {
  columns: [
    { name: 'Product', key: 'product' },
    { name: '2020', key: '2020' },
    { name: '2021', key: '2021' },
    { name: '2022', key: '2022' },
  ],
  items: [
    { product: 'Widget A', '2020': 100, '2021': 120, '2022': 150 },
    { product: 'Widget B', '2020': 200, '2021': 180, '2022': 220 },
    { product: 'Widget C', '2020': 50, '2021': 75, '2022': 90 },
  ],
};

export const largeMockData = {
  columns: mockSpreadsheetData.columns,
  items: Array.from({ length: 100 }, (_, i) => ({
    product: `Product ${i}`,
    '2020': Math.floor(Math.random() * 1000),
    '2021': Math.floor(Math.random() * 1000),
    '2022': Math.floor(Math.random() * 1000),
  })),
};

export const emptyMockData = {
  columns: [],
  items: [],
};

// Mock callbacks
export const createMockCallbacks = () => ({
  onHeaderChange: jest.fn(),
  onAddColumns: jest.fn(),
  onInsertColumn: jest.fn(),
  onReorderColumns: jest.fn(),
});

// Enhanced render function with common setup
export const renderSpreadsheet = (ui: React.ReactElement, options?: RenderOptions) => {
  const user = userEvent.setup();
  
  return {
    user,
    ...render(ui, options),
  };
};

// Helper functions for common test actions
export const testHelpers = {
  // Cell selection helpers
  async selectCell(user: any, cellText: string) {
    const cell = document.querySelector(`td:contains("${cellText}")`) as HTMLElement;
    if (cell) {
      await user.click(cell);
    }
    return cell;
  },

  // Edit helpers
  async editCell(user: any, cellText: string, newValue: string) {
    const cell = document.querySelector(`td:contains("${cellText}")`) as HTMLElement;
    if (cell) {
      await user.dblClick(cell);
      const input = document.querySelector('input[value="' + cellText + '"]') as HTMLInputElement;
      if (input) {
        await user.clear(input);
        await user.type(input, newValue);
        await user.keyboard('{Enter}');
      }
    }
  },

  // Filter helpers
  async applyFilter(user: any, filterText: string) {
    const filterInput = document.querySelector('input[placeholder="Filter..."]') as HTMLInputElement;
    if (filterInput) {
      await user.clear(filterInput);
      await user.type(filterInput, filterText);
    }
  },

  // Sort helpers
  async sortColumn(user: any, columnIndex: number) {
    const sortButtons = document.querySelectorAll('[title="Sort column"]');
    if (sortButtons[columnIndex]) {
      await user.click(sortButtons[columnIndex]);
    }
  },

  // Keyboard navigation helpers
  sendKey(key: string, options: any = {}) {
    return new KeyboardEvent('keydown', { key, ...options });
  },

  // Drag and drop helpers
  createDragEvent(type: string, dataTransfer: any = {}) {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        setData: jest.fn(),
        getData: jest.fn(),
        effectAllowed: 'move',
        dropEffect: 'move',
        ...dataTransfer,
      },
    });
    return event;
  },

  // Wait helpers
  async waitForElement(selector: string, timeout = 1000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        } else {
          setTimeout(checkElement, 10);
        }
      };
      checkElement();
    });
  },
};

// Assertion helpers
export const assertions = {
  // Check if cell is selected
  isCellSelected(cellElement: HTMLElement) {
    return cellElement.closest('td')?.classList.contains('bg-blue-100') || false;
  },

  // Check if cell is in edit mode
  isCellEditing(cellText: string) {
    return document.querySelector(`input[value="${cellText}"]`) !== null;
  },

  // Check filter state
  getFilterValue() {
    const filterInput = document.querySelector('input[placeholder="Filter..."]') as HTMLInputElement;
    return filterInput?.value || '';
  },

  // Check sort state
  getSortDirection(columnIndex: number) {
    const sortButtons = document.querySelectorAll('[title="Sort column"]');
    const button = sortButtons[columnIndex] as HTMLElement;
    if (button?.textContent?.includes('↑')) return 'asc';
    if (button?.textContent?.includes('↓')) return 'desc';
    return 'none';
  },

  // Check if element has drag styling
  isDragging(element: HTMLElement) {
    return element.classList.contains('opacity-50');
  },

  // Check if element has drop zone styling
  isDropZone(element: HTMLElement) {
    return (
      element.classList.contains('border-l-4') ||
      element.classList.contains('border-t-4')
    );
  },
};

// Custom matchers for Jest
export const customMatchers = {
  toBeSelected(received: HTMLElement) {
    const pass = assertions.isCellSelected(received);
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be selected`,
      pass,
    };
  },

  toBeEditing(received: string) {
    const pass = assertions.isCellEditing(received);
    return {
      message: () =>
        `expected cell with text "${received}" ${pass ? 'not ' : ''}to be in edit mode`,
      pass,
    };
  },

  toHaveSortDirection(received: number, expected: string) {
    const actual = assertions.getSortDirection(received);
    const pass = actual === expected;
    return {
      message: () =>
        `expected column ${received} to have sort direction "${expected}", but got "${actual}"`,
      pass,
    };
  },
};

// Test data generators
export const dataGenerators = {
  createSpreadsheetData(rows: number, cols: number) {
    const columns = Array.from({ length: cols }, (_, i) => ({
      name: `Column ${String.fromCharCode(65 + i)}`,
      key: `col_${i}`,
    }));

    const items = Array.from({ length: rows }, (_, rowIndex) => {
      const item: any = {};
      columns.forEach((col, colIndex) => {
        if (colIndex === 0) {
          item[col.key] = `Item ${rowIndex + 1}`;
        } else {
          item[col.key] = Math.floor(Math.random() * 1000);
        }
      });
      return item;
    });

    return { columns, items };
  },

  createNumericData(rows: number) {
    return {
      columns: [
        { name: 'Product', key: 'product' },
        { name: 'Value', key: 'value' },
      ],
      items: Array.from({ length: rows }, (_, i) => ({
        product: `Product ${i}`,
        value: Math.floor(Math.random() * 1000),
      })),
    };
  },

  createMixedTypeData() {
    return {
      columns: [
        { name: 'Mixed', key: 'mixed' },
        { name: 'Type', key: 'type' },
      ],
      items: [
        { mixed: 'text', type: 'string' },
        { mixed: 123, type: 'number' },
        { mixed: 'another', type: 'string' },
        { mixed: 456, type: 'number' },
      ],
    };
  },
};

// Performance testing utilities
export const performanceUtils = {
  async measureRenderTime(renderFn: () => void) {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    return end - start;
  },

  async measureAsyncOperation(asyncFn: () => Promise<void>) {
    const start = performance.now();
    await asyncFn();
    const end = performance.now();
    return end - start;
  },
};

// Mock implementations for external dependencies
export const mockImplementations = {
  createMockDataTransfer() {
    return {
      setData: jest.fn(),
      getData: jest.fn(),
      effectAllowed: 'move',
      dropEffect: 'move',
      files: [],
      items: [],
      types: [],
    };
  },

  createMockKeyboardEvent(key: string, options: any = {}) {
    return new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });
  },

  createMockMouseEvent(type: string, options: any = {}) {
    return new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      ...options,
    });
  },
};

export default {
  mockSpreadsheetData,
  largeMockData,
  emptyMockData,
  createMockCallbacks,
  renderSpreadsheet,
  testHelpers,
  assertions,
  customMatchers,
  dataGenerators,
  performanceUtils,
  mockImplementations,
};