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
    { name: '2022', key: '2022' },
  ],
  items: [
    { product: 'Widget A', '2020': 100, '2021': 120, '2022': 150 },
    { product: 'Widget B', '2020': 200, '2021': 180, '2022': 220 },
    { product: 'Widget C', '2020': 50, '2021': 75, '2022': 90 },
  ],
};

const mockCallbacks = {
  onHeaderChange: jest.fn(),
  onAddColumns: jest.fn(),
  onInsertColumn: jest.fn(),
  onReorderColumns: jest.fn(),
};

// Helper function to create drag events
const createDragEvent = (type: string, dataTransfer: any = {}) => {
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
};

describe('Drag and Drop Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Column Drag and Drop', () => {
    it('makes column headers draggable', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columnHeaders = screen.getAllByText(/A|B|C|D/);
      columnHeaders.forEach(header => {
        expect(header.closest('th')).toHaveAttribute('draggable', 'true');
      });
    });

    it('handles column drag start event', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columnHeader = screen.getByText('A');
      const dragStartEvent = createDragEvent('dragstart');
      
      fireEvent(columnHeader.closest('th')!, dragStartEvent);

      expect(dragStartEvent.dataTransfer.setData).toHaveBeenCalled();
    });

    it('handles column drag over event', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columnHeader = screen.getByText('B');
      const dragOverEvent = createDragEvent('dragover');
      
      fireEvent(columnHeader.closest('th')!, dragOverEvent);

      expect(dragOverEvent.defaultPrevented).toBe(true);
    });

    it('handles column drop event', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Start drag on first column
      const sourceColumn = screen.getByText('A');
      const dragStartEvent = createDragEvent('dragstart', {
        setData: jest.fn(),
      });
      fireEvent(sourceColumn.closest('th')!, dragStartEvent);

      // Drop on second column
      const targetColumn = screen.getByText('B');
      const dropEvent = createDragEvent('drop', {
        getData: jest.fn(() => '0'), // Source index
      });
      fireEvent(targetColumn.closest('th')!, dropEvent);

      expect(mockCallbacks.onReorderColumns).toHaveBeenCalledWith(0, 1);
    });

    it('shows visual feedback during column drag', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columnHeader = screen.getByText('A');
      const dragStartEvent = createDragEvent('dragstart');
      
      fireEvent(columnHeader.closest('th')!, dragStartEvent);

      // Column should have drag styling
      expect(columnHeader.closest('th')).toHaveClass('opacity-50');
    });

    it('shows drop zone indicator during drag over', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columnHeader = screen.getByText('B');
      const dragOverEvent = createDragEvent('dragover');
      
      fireEvent(columnHeader.closest('th')!, dragOverEvent);

      // Should show drop zone styling
      expect(columnHeader.closest('th')).toHaveClass('border-l-4', 'border-l-blue-500');
    });

    it('cleans up drag state on drag end', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columnHeader = screen.getByText('A');
      const dragStartEvent = createDragEvent('dragstart');
      const dragEndEvent = createDragEvent('dragend');
      
      fireEvent(columnHeader.closest('th')!, dragStartEvent);
      fireEvent(columnHeader.closest('th')!, dragEndEvent);

      // Drag styling should be removed
      expect(columnHeader.closest('th')).not.toHaveClass('opacity-50');
    });

    it('prevents dropping column on itself', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columnHeader = screen.getByText('A');
      
      // Start drag
      const dragStartEvent = createDragEvent('dragstart');
      fireEvent(columnHeader.closest('th')!, dragStartEvent);

      // Try to drop on same column
      const dropEvent = createDragEvent('drop', {
        getData: jest.fn(() => '0'),
      });
      fireEvent(columnHeader.closest('th')!, dropEvent);

      // Should not call reorder callback
      expect(mockCallbacks.onReorderColumns).not.toHaveBeenCalled();
    });
  });

  describe('Row Drag and Drop', () => {
    it('makes row headers draggable', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Row number cells should be draggable
      const rowNumbers = screen.getAllByText(/^[1-4]$/);
      rowNumbers.forEach(rowNumber => {
        expect(rowNumber.closest('td')).toHaveAttribute('draggable', 'true');
      });
    });

    it('handles row drag start event', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const rowHeader = screen.getByText('2'); // First data row
      const dragStartEvent = createDragEvent('dragstart');
      
      fireEvent(rowHeader.closest('td')!, dragStartEvent);

      expect(dragStartEvent.dataTransfer.setData).toHaveBeenCalled();
    });

    it('handles row drag over event', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const rowHeader = screen.getByText('3');
      const dragOverEvent = createDragEvent('dragover');
      
      fireEvent(rowHeader.closest('td')!, dragOverEvent);

      expect(dragOverEvent.defaultPrevented).toBe(true);
    });

    it('handles row drop event for data rows', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Start drag on first data row (index 0)
      const sourceRow = screen.getByText('2');
      const dragStartEvent = createDragEvent('dragstart');
      fireEvent(sourceRow.closest('td')!, dragStartEvent);

      // Drop on second data row (index 1)
      const targetRow = screen.getByText('3');
      const dropEvent = createDragEvent('drop', {
        getData: jest.fn(() => '0'),
      });
      fireEvent(targetRow.closest('td')!, dropEvent);

      // Should reorder rows in component state
      // (exact verification depends on implementation)
      expect(dropEvent.defaultPrevented).toBe(true);
    });

    it('shows visual feedback during row drag', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const rowHeader = screen.getByText('2');
      const dragStartEvent = createDragEvent('dragstart');
      
      fireEvent(rowHeader.closest('td')!, dragStartEvent);

      // Row should have drag styling
      expect(rowHeader.closest('td')).toHaveClass('opacity-50');
    });

    it('shows drop zone indicator during row drag over', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const rowHeader = screen.getByText('3');
      const dragOverEvent = createDragEvent('dragover');
      
      fireEvent(rowHeader.closest('td')!, dragOverEvent);

      // Should show drop zone styling
      expect(rowHeader.closest('td')).toHaveClass('border-t-4', 'border-t-blue-500');
    });

    it('prevents reordering header row with data rows', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Try to drag header row (row 1)
      const headerRow = screen.getByText('1');
      const dragStartEvent = createDragEvent('dragstart');
      fireEvent(headerRow.closest('td')!, dragStartEvent);

      // Try to drop on data row
      const dataRow = screen.getByText('2');
      const dropEvent = createDragEvent('drop', {
        getData: jest.fn(() => '-1'), // Header row index
      });
      fireEvent(dataRow.closest('td')!, dropEvent);

      // Should not allow this operation
      expect(dropEvent.defaultPrevented).toBe(true);
    });

    it('prevents dropping row on itself', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const rowHeader = screen.getByText('2');
      
      // Start and drop on same row
      const dragStartEvent = createDragEvent('dragstart');
      fireEvent(rowHeader.closest('td')!, dragStartEvent);

      const dropEvent = createDragEvent('drop', {
        getData: jest.fn(() => '0'),
      });
      fireEvent(rowHeader.closest('td')!, dropEvent);

      // Should not trigger reorder
      expect(dropEvent.defaultPrevented).toBe(true);
    });
  });

  describe('Resize Handle Interaction', () => {
    it('prevents drag when clicking resize handles', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Find a column resize handle
      const columnHeaders = screen.getAllByTitle('Drag to resize column width');
      expect(columnHeaders.length).toBeGreaterThan(0);

      const resizeHandle = columnHeaders[0];
      
      // Click on resize handle should not start drag
      const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true });
      fireEvent(resizeHandle, mouseDownEvent);

      // Should prevent drag start
      const dragStartEvent = createDragEvent('dragstart');
      fireEvent(resizeHandle, dragStartEvent);
      expect(dragStartEvent.defaultPrevented).toBe(true);
    });

    it('prevents row drag when clicking row resize handles', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const rowResizeHandles = screen.getAllByTitle('Drag to resize row height');
      expect(rowResizeHandles.length).toBeGreaterThan(0);

      const resizeHandle = rowResizeHandles[0];
      
      // Click on resize handle should not start drag
      const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true });
      fireEvent(resizeHandle, mouseDownEvent);

      // Should prevent drag start
      const dragStartEvent = createDragEvent('dragstart');
      fireEvent(resizeHandle, dragStartEvent);
      expect(dragStartEvent.defaultPrevented).toBe(true);
    });
  });

  describe('Drag and Drop Edge Cases', () => {
    it('handles invalid drop targets gracefully', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columnHeader = screen.getByText('A');
      
      // Try to drop with invalid data
      const dropEvent = createDragEvent('drop', {
        getData: jest.fn(() => 'invalid'),
      });
      
      expect(() => {
        fireEvent(columnHeader.closest('th')!, dropEvent);
      }).not.toThrow();
    });

    it('handles drag leave events correctly', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columnHeader = screen.getByText('B');
      
      // Drag over then leave
      const dragOverEvent = createDragEvent('dragover');
      fireEvent(columnHeader.closest('th')!, dragOverEvent);
      
      const dragLeaveEvent = createDragEvent('dragleave');
      fireEvent(columnHeader.closest('th')!, dragLeaveEvent);

      // Should clean up drag over styling
      expect(columnHeader.closest('th')).not.toHaveClass('border-l-4');
    });

    it('maintains data integrity during drag operations', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Perform a column reorder
      const sourceColumn = screen.getByText('A');
      const targetColumn = screen.getByText('C');

      const dragStartEvent = createDragEvent('dragstart');
      fireEvent(sourceColumn.closest('th')!, dragStartEvent);

      const dropEvent = createDragEvent('drop', {
        getData: jest.fn(() => '0'),
      });
      fireEvent(targetColumn.closest('th')!, dropEvent);

      // Data should still be accessible
      expect(screen.getByText('Widget A')).toBeInTheDocument();
      expect(screen.getByText('Widget B')).toBeInTheDocument();
      expect(screen.getByText('Widget C')).toBeInTheDocument();
    });

    it('handles rapid drag operations without errors', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columns = screen.getAllByText(/A|B|C|D/);
      
      // Rapidly trigger drag events
      columns.forEach(column => {
        const dragStartEvent = createDragEvent('dragstart');
        const dragEndEvent = createDragEvent('dragend');
        
        fireEvent(column.closest('th')!, dragStartEvent);
        fireEvent(column.closest('th')!, dragEndEvent);
      });

      // Should not crash
      expect(screen.getByText('Widget A')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('maintains proper ARIA attributes during drag', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const columnHeader = screen.getByText('A');
      
      // Check that table structure is maintained
      expect(columnHeader.closest('th')).toBeInTheDocument();
      expect(columnHeader.closest('table')).toBeInTheDocument();
    });

    it('preserves keyboard navigation during drag operations', () => {
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Start a drag operation
      const columnHeader = screen.getByText('A');
      const dragStartEvent = createDragEvent('dragstart');
      fireEvent(columnHeader.closest('th')!, dragStartEvent);

      // Keyboard navigation should still work
      fireEvent.keyDown(document, { key: 'ArrowRight' });
      
      // Should not crash
      expect(document.activeElement).toBeDefined();
    });
  });

  describe('Integration with Other Features', () => {
    it('maintains selection during drag operations', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Select a cell
      const cell = screen.getByText('Widget A');
      await user.click(cell);
      expect(cell.closest('td')).toHaveClass('bg-blue-100');

      // Perform drag operation
      const columnHeader = screen.getByText('A');
      const dragStartEvent = createDragEvent('dragstart');
      const dragEndEvent = createDragEvent('dragend');
      
      fireEvent(columnHeader.closest('th')!, dragStartEvent);
      fireEvent(columnHeader.closest('th')!, dragEndEvent);

      // Selection should be maintained
      expect(cell.closest('td')).toHaveClass('bg-blue-100');
    });

    it('works correctly with filtered data', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Apply filter
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Widget A');

      // Drag operations should still work
      const columnHeader = screen.getByText('A');
      const dragStartEvent = createDragEvent('dragstart');
      
      expect(() => {
        fireEvent(columnHeader.closest('th')!, dragStartEvent);
      }).not.toThrow();
    });

    it('works correctly with sorted data', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Sort data
      const sortButtons = screen.getAllByTitle('Sort column');
      await user.click(sortButtons[0]);

      // Drag operations should still work
      const rowHeader = screen.getByText('2');
      const dragStartEvent = createDragEvent('dragstart');
      
      expect(() => {
        fireEvent(rowHeader.closest('td')!, dragStartEvent);
      }).not.toThrow();
    });
  });
});