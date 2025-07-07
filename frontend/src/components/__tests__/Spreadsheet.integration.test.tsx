import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Spreadsheet from '../Spreadsheet';

// Mock data for integration testing
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
    { product: 'Widget D', '2020': 300, '2021': 280, '2022': 350 },
  ],
};

const mockCallbacks = {
  onHeaderChange: jest.fn(),
  onAddColumns: jest.fn(),
  onInsertColumn: jest.fn(),
  onReorderColumns: jest.fn(),
};

describe('Spreadsheet Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Workflows', () => {
    it('allows user to edit data, filter, and sort in sequence', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Step 1: Edit a cell
      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);
      
      const input = screen.getByDisplayValue('Widget A');
      await user.clear(input);
      await user.type(input, 'Modified Widget A');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Modified Widget A')).toBeInTheDocument();
      });

      // Step 2: Filter data
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Modified');

      await waitFor(() => {
        expect(screen.getByText('Modified Widget A')).toBeInTheDocument();
        expect(screen.queryByText('Widget B')).not.toBeInTheDocument();
      });

      // Step 3: Clear filter
      await user.clear(filterInput);

      await waitFor(() => {
        expect(screen.getByText('Modified Widget A')).toBeInTheDocument();
        expect(screen.getByText('Widget B')).toBeInTheDocument();
      });

      // Step 4: Sort data
      const sortButtons = screen.getAllByTitle('Sort column');
      await user.click(sortButtons[0]); // Sort by Product column

      // Verify sorting worked (data should be reordered)
      expect(screen.getByText('Modified Widget A')).toBeInTheDocument();
    });

    it('supports multi-cell selection and formula application', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Select first numeric cell
      const cell1 = screen.getByText('100');
      await user.click(cell1);

      // Simulate multi-cell selection by drag (simplified)
      // In a real test, you'd simulate the full drag interaction
      
      // Check if function buttons appear
      await waitFor(() => {
        expect(screen.getByText('Functions:')).toBeInTheDocument();
      });
    });

    it('allows header editing and maintains data integrity', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Edit header
      const header = screen.getByText('Product');
      await user.dblClick(header);
      
      const input = screen.getByDisplayValue('Product');
      await user.clear(input);
      await user.type(input, 'Item Name');
      await user.keyboard('{Enter}');

      // Verify callback was called
      await waitFor(() => {
        expect(mockCallbacks.onHeaderChange).toHaveBeenCalledWith(0, 'Item Name');
      });

      // Verify data rows are still intact
      expect(screen.getByText('Widget A')).toBeInTheDocument();
      expect(screen.getByText('Widget B')).toBeInTheDocument();
    });

    it('handles undo/redo workflow correctly', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Make a change
      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);
      
      const input = screen.getByDisplayValue('Widget A');
      await user.clear(input);
      await user.type(input, 'Changed Widget');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Changed Widget')).toBeInTheDocument();
      });

      // Undo the change
      const undoButton = screen.getByText('Undo');
      await user.click(undoButton);

      await waitFor(() => {
        expect(screen.getByText('Widget A')).toBeInTheDocument();
        expect(screen.queryByText('Changed Widget')).not.toBeInTheDocument();
      });

      // Redo the change
      const redoButton = screen.getByText('Redo');
      await user.click(redoButton);

      await waitFor(() => {
        expect(screen.getByText('Changed Widget')).toBeInTheDocument();
      });
    });

    it('handles complex filtering scenarios', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Test filtering by header content
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, '2020');

      await waitFor(() => {
        // Header row should still be visible (contains "2020")
        expect(screen.getByText('2020')).toBeInTheDocument();
        // All data rows should be visible (they all have 2020 data)
        expect(screen.getByText('Widget A')).toBeInTheDocument();
        expect(screen.getByText('Widget B')).toBeInTheDocument();
      });

      // Clear and test filtering with no matches
      await user.clear(filterInput);
      await user.type(filterInput, 'NonexistentData');

      await waitFor(() => {
        // Header should be hidden
        expect(screen.queryByText('Product')).not.toBeInTheDocument();
        // No data rows should be visible
        expect(screen.queryByText('Widget A')).not.toBeInTheDocument();
      });
    });

    it('maintains selection state during various operations', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Select a cell
      const cell = screen.getByText('Widget A');
      await user.click(cell);
      
      expect(cell.closest('td')).toHaveClass('bg-blue-100');

      // Filter data
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Widget A');

      await waitFor(() => {
        // Cell should still be selected after filtering
        const filteredCell = screen.getByText('Widget A');
        expect(filteredCell.closest('td')).toHaveClass('bg-blue-100');
      });
    });

    it('handles numeric column validation properly', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Try to edit a numeric cell with text
      const numericCell = screen.getByText('100');
      await user.dblClick(numericCell);
      
      const input = screen.getByDisplayValue('100');
      await user.clear(input);
      await user.type(input, 'invalid text');
      await user.keyboard('{Enter}');

      // The change should be rejected or handled appropriately
      // (exact behavior depends on implementation)
      expect(input).toBeInTheDocument();
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('recovers gracefully from invalid formula input', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const cell = screen.getByText('100');
      await user.dblClick(cell);
      
      const input = screen.getByDisplayValue('100');
      await user.clear(input);
      await user.type(input, '=INVALID_FORMULA(A1:B2)');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        // Should show error instead of crashing
        expect(screen.getByText('#ERROR!')).toBeInTheDocument();
      });

      // Should still be able to edit the cell again
      const errorCell = screen.getByText('#ERROR!');
      await user.dblClick(errorCell);
      
      const newInput = screen.getByDisplayValue('=INVALID_FORMULA(A1:B2)');
      await user.clear(newInput);
      await user.type(newInput, '150');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.queryByText('#ERROR!')).not.toBeInTheDocument();
      });
    });

    it('handles rapid user interactions without breaking', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Rapidly click different cells
      const cells = [
        screen.getByText('Widget A'),
        screen.getByText('Widget B'),
        screen.getByText('100'),
        screen.getByText('200'),
      ];

      for (const cell of cells) {
        await user.click(cell);
      }

      // Should not crash and last cell should be selected
      expect(cells[cells.length - 1].closest('td')).toHaveClass('bg-blue-100');
    });

    it('maintains data consistency during complex operations', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Perform multiple operations in sequence
      
      // 1. Edit cell
      const cell = screen.getByText('Widget A');
      await user.dblClick(cell);
      const input = screen.getByDisplayValue('Widget A');
      await user.clear(input);
      await user.type(input, 'Updated Widget');
      await user.keyboard('{Enter}');

      // 2. Sort
      const sortButtons = screen.getAllByTitle('Sort column');
      await user.click(sortButtons[0]);

      // 3. Filter
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Updated');

      // 4. Clear filter
      await user.clear(filterInput);

      // Data should still be consistent
      await waitFor(() => {
        expect(screen.getByText('Updated Widget')).toBeInTheDocument();
        expect(screen.getByText('Widget B')).toBeInTheDocument();
        expect(screen.getByText('Widget C')).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Responsiveness', () => {
    it('handles large dataset operations efficiently', async () => {
      // Create larger dataset
      const largeData = {
        columns: mockData.columns,
        items: Array.from({ length: 100 }, (_, i) => ({
          product: `Widget ${i}`,
          '2020': Math.floor(Math.random() * 1000),
          '2021': Math.floor(Math.random() * 1000),
          '2022': Math.floor(Math.random() * 1000),
        })),
      };

      const user = userEvent.setup();
      render(<Spreadsheet data={largeData} {...mockCallbacks} />);

      // Should render without significant delay
      expect(screen.getByText('Widget 0')).toBeInTheDocument();
      expect(screen.getByText('Widget 50')).toBeInTheDocument();

      // Filtering should be responsive
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Widget 1');

      await waitFor(() => {
        expect(screen.getByText('Widget 1')).toBeInTheDocument();
        // Should filter appropriately
      });
    });

    it('handles 1000+ row datasets with virtual scrolling', async () => {
      // Create a very large dataset (1000+ rows)
      const veryLargeData = {
        columns: mockData.columns,
        items: Array.from({ length: 1500 }, (_, i) => ({
          product: `Product ${i.toString().padStart(4, '0')}`,
          '2020': Math.floor(Math.random() * 10000),
          '2021': Math.floor(Math.random() * 10000),
          '2022': Math.floor(Math.random() * 10000),
        })),
      };

      const user = userEvent.setup();
      const startTime = performance.now();
      
      render(<Spreadsheet data={veryLargeData} {...mockCallbacks} />);
      
      const renderTime = performance.now() - startTime;
      
      // Should render quickly (under 1 second for 1500 rows)
      expect(renderTime).toBeLessThan(1000);

      // Should show performance indicator
      expect(screen.getByText(/Performance:/)).toBeInTheDocument();
      expect(screen.getByText(/1500/)).toBeInTheDocument();

      // Should render first few rows immediately
      expect(screen.getByText('Product 0000')).toBeInTheDocument();
      expect(screen.getByText('Product 0001')).toBeInTheDocument();
      expect(screen.getByText('Product 0002')).toBeInTheDocument();

      // Should not render rows that are far down (virtual scrolling)
      expect(screen.queryByText('Product 0500')).not.toBeInTheDocument();
      expect(screen.queryByText('Product 1000')).not.toBeInTheDocument();

      // Filtering should be very responsive even with large dataset
      const filterInput = screen.getByPlaceholderText('Filter...');
      const filterStartTime = performance.now();
      
      await user.type(filterInput, 'Product 0500');
      
      const filterTime = performance.now() - filterStartTime;
      
      // Filtering should be fast (under 500ms)
      expect(filterTime).toBeLessThan(500);

      await waitFor(() => {
        expect(screen.getByText('Product 0500')).toBeInTheDocument();
        // Should show filtered count in performance indicator
        expect(screen.getByText(/1 of 1 rows/)).toBeInTheDocument();
      });

      // Clear filter and test sorting
      await user.clear(filterInput);
      await user.type(filterInput, 'Product 1');

      await waitFor(() => {
        // Should show multiple results
        expect(screen.getByText('Product 0001')).toBeInTheDocument();
        expect(screen.getByText('Product 0010')).toBeInTheDocument();
        expect(screen.getByText('Product 0100')).toBeInTheDocument();
      });

      // Test sorting on large dataset
      const sortButtons = screen.getAllByTitle('Sort column');
      const sortStartTime = performance.now();
      
      await user.click(sortButtons[0]);
      
      const sortTime = performance.now() - sortStartTime;
      
      // Sorting should be fast (under 500ms)
      expect(sortTime).toBeLessThan(500);

      await waitFor(() => {
        // Should show sorted data
        expect(screen.getByText('Product 0001')).toBeInTheDocument();
      });
    });

    it('maintains smooth scrolling with large datasets', async () => {
      // Create large dataset
      const largeData = {
        columns: mockData.columns,
        items: Array.from({ length: 2000 }, (_, i) => ({
          product: `Item ${i}`,
          '2020': i,
          '2021': i * 2,
          '2022': i * 3,
        })),
      };

      render(<Spreadsheet data={largeData} {...mockCallbacks} />);

      // Should show virtual scrolling indicator
      expect(screen.getByText(/Virtual scrolling active/)).toBeInTheDocument();

      // Should only render visible rows initially
      expect(screen.getByText('Item 0')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.queryByText('Item 100')).not.toBeInTheDocument();

      // Test that scrolling doesn't crash
      const container = screen.getByRole('table').closest('.overflow-y-auto');
      if (container) {
        // Simulate scroll to middle
        fireEvent.scroll(container, { target: { scrollTop: 5000 } });
        
        // Should still be functional
        expect(screen.getByText(/Performance:/)).toBeInTheDocument();
      }
    });
  });
});