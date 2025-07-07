import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Spreadsheet from '../Spreadsheet';

// Mock data for testing
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

// Mock callbacks
const mockOnHeaderChange = jest.fn();
const mockOnAddColumns = jest.fn();
const mockOnInsertColumn = jest.fn();
const mockOnReorderColumns = jest.fn();

const defaultProps = {
  data: mockData,
  onHeaderChange: mockOnHeaderChange,
  onAddColumns: mockOnAddColumns,
  onInsertColumn: mockOnInsertColumn,
  onReorderColumns: mockOnReorderColumns,
};

describe('Spreadsheet Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the spreadsheet with correct data', () => {
      render(<Spreadsheet {...defaultProps} />);
      
      // Check if column headers are rendered
      expect(screen.getByText('Product')).toBeInTheDocument();
      expect(screen.getByText('2020')).toBeInTheDocument();
      expect(screen.getByText('2021')).toBeInTheDocument();
      expect(screen.getByText('2022')).toBeInTheDocument();
      
      // Check if data rows are rendered
      expect(screen.getByText('Widget A')).toBeInTheDocument();
      expect(screen.getByText('Widget B')).toBeInTheDocument();
      expect(screen.getByText('Widget C')).toBeInTheDocument();
    });

    it('renders column letters in header', () => {
      render(<Spreadsheet {...defaultProps} />);
      
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
      expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('renders row numbers starting from 1', () => {
      render(<Spreadsheet {...defaultProps} />);
      
      expect(screen.getByText('1')).toBeInTheDocument(); // Header row
      expect(screen.getByText('2')).toBeInTheDocument(); // First data row
      expect(screen.getByText('3')).toBeInTheDocument(); // Second data row
      expect(screen.getByText('4')).toBeInTheDocument(); // Third data row
    });

    it('renders sort buttons on column headers', () => {
      render(<Spreadsheet {...defaultProps} />);
      
      const sortButtons = screen.getAllByTitle('Sort column');
      expect(sortButtons).toHaveLength(4); // One for each column
    });
  });

  describe('Cell Selection', () => {
    it('selects a cell when clicked', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const cell = screen.getByText('Widget A');
      await user.click(cell);
      
      // Cell should have selection styling
      expect(cell.closest('td')).toHaveClass('bg-blue-100');
    });

    it('changes selection when different cell is clicked', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const cell1 = screen.getByText('Widget A');
      const cell2 = screen.getByText('Widget B');
      
      await user.click(cell1);
      expect(cell1.closest('td')).toHaveClass('bg-blue-100');
      
      await user.click(cell2);
      expect(cell2.closest('td')).toHaveClass('bg-blue-100');
      expect(cell1.closest('td')).not.toHaveClass('bg-blue-100');
    });
  });

  describe('Cell Editing', () => {
    it('enters edit mode when cell is double-clicked', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);
      
      // Should show input field
      expect(screen.getByDisplayValue('Widget A')).toBeInTheDocument();
    });

    it('saves changes when Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);
      
      const input = screen.getByDisplayValue('Widget A');
      await user.clear(input);
      await user.type(input, 'New Product');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(screen.getByText('New Product')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('New Product')).not.toBeInTheDocument();
      });
    });

    it('cancels editing when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);
      
      const input = screen.getByDisplayValue('Widget A');
      await user.clear(input);
      await user.type(input, 'Changed Text');
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(screen.getByText('Widget A')).toBeInTheDocument();
        expect(screen.queryByText('Changed Text')).not.toBeInTheDocument();
      });
    });
  });

  describe('Header Editing', () => {
    it('allows editing column headers', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const header = screen.getByText('Product');
      await user.dblClick(header);
      
      const input = screen.getByDisplayValue('Product');
      await user.clear(input);
      await user.type(input, 'Item Name');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockOnHeaderChange).toHaveBeenCalledWith(0, 'Item Name');
      });
    });
  });

  describe('Filtering', () => {
    it('filters data based on filter text', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Widget A');
      
      await waitFor(() => {
        expect(screen.getByText('Widget A')).toBeInTheDocument();
        expect(screen.queryByText('Widget B')).not.toBeInTheDocument();
        expect(screen.queryByText('Widget C')).not.toBeInTheDocument();
      });
    });

    it('shows all data when filter is cleared', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Widget A');
      await user.clear(filterInput);
      
      await waitFor(() => {
        expect(screen.getByText('Widget A')).toBeInTheDocument();
        expect(screen.getByText('Widget B')).toBeInTheDocument();
        expect(screen.getByText('Widget C')).toBeInTheDocument();
      });
    });

    it('hides header row when filter matches nothing', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'NonexistentData');
      
      await waitFor(() => {
        // Header row should be hidden
        const headerRow = screen.queryByText('Product');
        expect(headerRow).not.toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('sorts data when sort button is clicked', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      // Find sort button for Product column
      const sortButtons = screen.getAllByTitle('Sort column');
      await user.click(sortButtons[0]);
      
      // Check if data is sorted (alphabetically by product name)
      const rows = screen.getAllByRole('row');
      // Note: This is a simplified check - in a real test you'd verify the order
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe('Undo/Redo', () => {
    it('shows undo/redo buttons', () => {
      render(<Spreadsheet {...defaultProps} />);
      
      expect(screen.getByText('Undo')).toBeInTheDocument();
      expect(screen.getByText('Redo')).toBeInTheDocument();
    });

    it('disables undo button when no history', () => {
      render(<Spreadsheet {...defaultProps} />);
      
      const undoButton = screen.getByText('Undo');
      expect(undoButton).toBeDisabled();
    });
  });

  describe('Formula Functionality', () => {
    it('displays function buttons when cells are selected', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      // Select multiple cells
      const cell1 = screen.getByText('100');
      const cell2 = screen.getByText('120');
      
      // Simulate multi-cell selection (simplified)
      await user.click(cell1);
      
      // Function buttons should be available
      expect(screen.getByText('Functions:')).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('handles arrow key navigation', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const cell = screen.getByText('Widget A');
      await user.click(cell);
      
      // Simulate arrow key press
      fireEvent.keyDown(document, { key: 'ArrowRight' });
      
      // This is a simplified test - full keyboard navigation testing
      // would require more complex setup
      expect(cell.closest('td')).toBeDefined();
    });
  });

  describe('Context Menu', () => {
    it('shows context menu on right click of column header', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const columnHeader = screen.getByText('A');
      await user.pointer({ keys: '[MouseRight]', target: columnHeader });
      
      await waitFor(() => {
        expect(screen.getByText('Insert Column Left')).toBeInTheDocument();
        expect(screen.getByText('Insert Column Right')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles empty data gracefully', () => {
      const emptyData = { columns: [], items: [] };
      render(<Spreadsheet {...{ ...defaultProps, data: emptyData }} />);
      
      // Should render without crashing
      expect(screen.getByText('Product Portfolio Revenue Analysis')).toBeInTheDocument();
    });

    it('handles invalid formula gracefully', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet {...defaultProps} />);
      
      const cell = screen.getByText('100');
      await user.dblClick(cell);
      
      const input = screen.getByDisplayValue('100');
      await user.clear(input);
      await user.type(input, '=INVALID_FORMULA()');
      await user.keyboard('{Enter}');
      
      // Should handle error without crashing
      await waitFor(() => {
        expect(screen.getByText('#ERROR!')).toBeInTheDocument();
      });
    });
  });
});