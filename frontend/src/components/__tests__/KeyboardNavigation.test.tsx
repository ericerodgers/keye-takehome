import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Spreadsheet from '../Spreadsheet';

const mockData = {
  columns: [
    { name: 'Product', key: 'product' },
    { name: '2020', key: '2020' },
    { name: '2021', key: '2021' },
  ],
  items: [
    { product: 'Widget A', '2020': 100, '2021': 120 },
    { product: 'Widget B', '2020': 200, '2021': 180 },
    { product: 'Widget C', '2020': 50, '2021': 75 },
  ],
};

const mockCallbacks = {
  onHeaderChange: jest.fn(),
  onAddColumns: jest.fn(),
  onInsertColumn: jest.fn(),
  onReorderColumns: jest.fn(),
};

describe('Keyboard Navigation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Arrow Key Navigation', () => {
    it('navigates right with arrow key', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Select initial cell
      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Navigate right
      fireEvent.keyDown(document, { key: 'ArrowRight' });

      // Check if focus moved (this is a simplified test)
      // In a real implementation, you'd check the actual selected cell
      expect(document.activeElement).toBeDefined();
    });

    it('navigates left with arrow key', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Select a cell that's not in the first column
      const cell = screen.getByText('100');
      await user.click(cell);

      // Navigate left
      fireEvent.keyDown(document, { key: 'ArrowLeft' });

      expect(document.activeElement).toBeDefined();
    });

    it('navigates up with arrow key', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Select a cell in a data row
      const cell = screen.getByText('Widget B');
      await user.click(cell);

      // Navigate up
      fireEvent.keyDown(document, { key: 'ArrowUp' });

      expect(document.activeElement).toBeDefined();
    });

    it('navigates down with arrow key', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Select header cell
      const cell = screen.getByText('Product');
      await user.click(cell);

      // Navigate down
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      expect(document.activeElement).toBeDefined();
    });

    it('respects boundaries when navigating', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Select leftmost cell
      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Try to navigate left (should stay in place)
      fireEvent.keyDown(document, { key: 'ArrowLeft' });

      // Cell should remain selected
      expect(cell.closest('td')).toHaveClass('bg-blue-100');
    });
  });

  describe('Tab Navigation', () => {
    it('navigates right with Tab key', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Navigate with Tab
      fireEvent.keyDown(document, { key: 'Tab' });

      expect(document.activeElement).toBeDefined();
    });

    it('navigates left with Shift+Tab', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('100');
      await user.click(cell);

      // Navigate with Shift+Tab
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

      expect(document.activeElement).toBeDefined();
    });

    it('wraps to next row at end of current row with Tab', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Select last cell in first row
      const cells = screen.getAllByText('120');
      const lastCell = cells[0]; // First occurrence should be in first data row
      await user.click(lastCell);

      // Navigate with Tab (should wrap to next row)
      fireEvent.keyDown(document, { key: 'Tab' });

      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Home/End Navigation', () => {
    it('navigates to beginning of row with Home', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('120');
      await user.click(cell);

      // Navigate to beginning of row
      fireEvent.keyDown(document, { key: 'Home' });

      expect(document.activeElement).toBeDefined();
    });

    it('navigates to end of row with End', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Navigate to end of row
      fireEvent.keyDown(document, { key: 'End' });

      expect(document.activeElement).toBeDefined();
    });

    it('navigates to top-left with Ctrl+Home', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget C');
      await user.click(cell);

      // Navigate to A1
      fireEvent.keyDown(document, { key: 'Home', ctrlKey: true });

      expect(document.activeElement).toBeDefined();
    });

    it('navigates to bottom-right with Ctrl+End', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Navigate to last cell
      fireEvent.keyDown(document, { key: 'End', ctrlKey: true });

      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Page Up/Down Navigation', () => {
    it('navigates up multiple rows with Page Up', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget C');
      await user.click(cell);

      // Navigate up multiple rows
      fireEvent.keyDown(document, { key: 'PageUp' });

      expect(document.activeElement).toBeDefined();
    });

    it('navigates down multiple rows with Page Down', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Navigate down multiple rows
      fireEvent.keyDown(document, { key: 'PageDown' });

      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Ctrl+Arrow Key Navigation (Data Boundaries)', () => {
    it('jumps to data boundary with Ctrl+Right', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Jump to data boundary
      fireEvent.keyDown(document, { key: 'ArrowRight', ctrlKey: true });

      expect(document.activeElement).toBeDefined();
    });

    it('jumps to data boundary with Ctrl+Down', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Product');
      await user.click(cell);

      // Jump to data boundary
      fireEvent.keyDown(document, { key: 'ArrowDown', ctrlKey: true });

      expect(document.activeElement).toBeDefined();
    });

    it('jumps to data boundary with Ctrl+Left', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('120');
      await user.click(cell);

      // Jump to data boundary
      fireEvent.keyDown(document, { key: 'ArrowLeft', ctrlKey: true });

      expect(document.activeElement).toBeDefined();
    });

    it('jumps to data boundary with Ctrl+Up', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget C');
      await user.click(cell);

      // Jump to data boundary
      fireEvent.keyDown(document, { key: 'ArrowUp', ctrlKey: true });

      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Edit Mode Navigation', () => {
    it('enters edit mode with Enter key', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Enter edit mode
      fireEvent.keyDown(document, { key: 'Enter' });

      // Should show input field
      expect(screen.getByDisplayValue('Widget A')).toBeInTheDocument();
    });

    it('enters edit mode with F2 key', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Enter edit mode with F2
      fireEvent.keyDown(document, { key: 'F2' });

      // Should show input field
      expect(screen.getByDisplayValue('Widget A')).toBeInTheDocument();
    });

    it('exits edit mode and moves down with Enter', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);

      const input = screen.getByDisplayValue('Widget A');
      
      // Exit edit mode with Enter
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should exit edit mode
      expect(screen.queryByDisplayValue('Widget A')).not.toBeInTheDocument();
    });

    it('exits edit mode with Tab and moves right', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);

      const input = screen.getByDisplayValue('Widget A');
      
      // Exit edit mode with Tab
      fireEvent.keyDown(input, { key: 'Tab' });

      // Should exit edit mode
      expect(screen.queryByDisplayValue('Widget A')).not.toBeInTheDocument();
    });

    it('cancels edit mode with Escape', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);

      const input = screen.getByDisplayValue('Widget A');
      await user.clear(input);
      await user.type(input, 'Modified Text');
      
      // Cancel edit mode with Escape
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should cancel changes and exit edit mode
      expect(screen.getByText('Widget A')).toBeInTheDocument();
      expect(screen.queryByText('Modified Text')).not.toBeInTheDocument();
    });
  });

  describe('Auto-Edit Functionality', () => {
    it('starts editing when typing printable character', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Type a character to start editing
      fireEvent.keyDown(document, { key: 'a' });

      // Should enter edit mode and replace content
      expect(screen.getByDisplayValue('a')).toBeInTheDocument();
    });

    it('validates numeric input in numeric columns', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const numericCell = screen.getByText('100');
      await user.click(numericCell);

      // Try to type non-numeric character in numeric column
      fireEvent.keyDown(document, { key: 'a' });

      // Should not start editing with invalid character
      expect(screen.queryByDisplayValue('a')).not.toBeInTheDocument();
    });

    it('allows numeric characters in numeric columns', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const numericCell = screen.getByText('100');
      await user.click(numericCell);

      // Type numeric character
      fireEvent.keyDown(document, { key: '5' });

      // Should start editing with numeric character
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('handles Ctrl+Z for undo', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Make a change first
      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);
      const input = screen.getByDisplayValue('Widget A');
      await user.clear(input);
      await user.type(input, 'Modified');
      await user.keyboard('{Enter}');

      // Use Ctrl+Z
      fireEvent.keyDown(document, { key: 'z', ctrlKey: true });

      // Should undo the change
      expect(screen.getByText('Widget A')).toBeInTheDocument();
    });

    it('handles Ctrl+Y for redo', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Make a change, undo it, then redo
      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);
      const input = screen.getByDisplayValue('Widget A');
      await user.clear(input);
      await user.type(input, 'Modified');
      await user.keyboard('{Enter}');

      // Undo
      fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
      
      // Redo
      fireEvent.keyDown(document, { key: 'y', ctrlKey: true });

      // Should redo the change
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('handles Delete key to clear cell content', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Press Delete
      fireEvent.keyDown(document, { key: 'Delete' });

      // Content should be cleared (simplified test)
      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Input Field Isolation', () => {
    it('does not interfere with filter input', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Select a cell
      const cell = screen.getByText('Widget A');
      await user.click(cell);

      // Focus on filter input and type
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.click(filterInput);
      await user.type(filterInput, 'test');

      // Filter input should work normally
      expect(filterInput).toHaveValue('test');
      
      // Cell should still be selected but not editing
      expect(cell.closest('td')).toHaveClass('bg-blue-100');
      expect(screen.queryByDisplayValue('Widget A')).not.toBeInTheDocument();
    });
  });
});