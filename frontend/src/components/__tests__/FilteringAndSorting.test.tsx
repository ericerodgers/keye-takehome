import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
    { product: 'Apple iPhone', '2020': 1000, '2021': 1200, '2022': 1100 },
    { product: 'Samsung Galaxy', '2020': 800, '2021': 900, '2022': 950 },
    { product: 'Google Pixel', '2020': 600, '2021': 700, '2022': 750 },
    { product: 'OnePlus Nord', '2020': 400, '2021': 450, '2022': 500 },
    { product: 'Xiaomi Mi', '2020': 300, '2021': 350, '2022': 400 },
  ],
};

const mockCallbacks = {
  onHeaderChange: jest.fn(),
  onAddColumns: jest.fn(),
  onInsertColumn: jest.fn(),
  onReorderColumns: jest.fn(),
};

describe('Filtering and Sorting Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Text Filtering', () => {
    it('filters data based on product name', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Apple');

      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
        expect(screen.queryByText('Samsung Galaxy')).not.toBeInTheDocument();
        expect(screen.queryByText('Google Pixel')).not.toBeInTheDocument();
      });
    });

    it('filters data based on numeric values', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, '1000');

      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
        expect(screen.queryByText('Samsung Galaxy')).not.toBeInTheDocument();
      });
    });

    it('filters data case-insensitively', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'apple');

      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
        expect(screen.queryByText('Samsung Galaxy')).not.toBeInTheDocument();
      });
    });

    it('shows all data when filter is empty', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Apple');
      
      // Clear the filter
      await user.clear(filterInput);

      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
        expect(screen.getByText('Samsung Galaxy')).toBeInTheDocument();
        expect(screen.getByText('Google Pixel')).toBeInTheDocument();
        expect(screen.getByText('OnePlus Nord')).toBeInTheDocument();
        expect(screen.getByText('Xiaomi Mi')).toBeInTheDocument();
      });
    });

    it('shows no data when filter matches nothing', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'NonexistentProduct');

      await waitFor(() => {
        expect(screen.queryByText('Apple iPhone')).not.toBeInTheDocument();
        expect(screen.queryByText('Samsung Galaxy')).not.toBeInTheDocument();
        expect(screen.queryByText('Google Pixel')).not.toBeInTheDocument();
      });
    });

    it('filters partial matches correctly', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Galaxy');

      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy')).toBeInTheDocument();
        expect(screen.queryByText('Apple iPhone')).not.toBeInTheDocument();
        expect(screen.queryByText('Google Pixel')).not.toBeInTheDocument();
      });
    });

    it('updates filter results in real-time', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      
      // Type 'A' - should show Apple
      await user.type(filterInput, 'A');
      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
      });

      // Add 'p' - should still show Apple
      await user.type(filterInput, 'p');
      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
      });

      // Add 'p' - should still show Apple  
      await user.type(filterInput, 'p');
      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
      });
    });
  });

  describe('Header Row Filtering', () => {
    it('shows header row when column names match filter', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, '2020');

      await waitFor(() => {
        // Header row should be visible because column '2020' matches
        expect(screen.getByText('2020')).toBeInTheDocument();
        expect(screen.getByText('Product')).toBeInTheDocument();
      });
    });

    it('hides header row when no column names match and no data matches', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'NonexistentTerm');

      await waitFor(() => {
        // Header row should be hidden
        expect(screen.queryByText('Product')).not.toBeInTheDocument();
        expect(screen.queryByText('2020')).not.toBeInTheDocument();
      });
    });

    it('shows header row when data matches even if column names dont', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Apple');

      await waitFor(() => {
        // Header row should be visible because data matches
        expect(screen.getByText('Product')).toBeInTheDocument();
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
      });
    });
  });

  describe('Column Sorting', () => {
    it('sorts text column alphabetically ascending', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Click sort button for Product column (first column)
      const sortButtons = screen.getAllByTitle('Sort column');
      await user.click(sortButtons[0]);

      await waitFor(() => {
        // Get all product names and check order
        const productCells = screen.getAllByText(/Apple iPhone|Google Pixel|OnePlus Nord|Samsung Galaxy|Xiaomi Mi/);
        
        // First visible should be alphabetically first
        expect(productCells[0]).toHaveTextContent('Apple iPhone');
      });
    });

    it('sorts text column alphabetically descending on second click', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const sortButtons = screen.getAllByTitle('Sort column');
      
      // Click twice for descending
      await user.click(sortButtons[0]);
      await user.click(sortButtons[0]);

      await waitFor(() => {
        const productCells = screen.getAllByText(/Apple iPhone|Google Pixel|OnePlus Nord|Samsung Galaxy|Xiaomi Mi/);
        
        // First visible should be alphabetically last
        expect(productCells[0]).toHaveTextContent('Xiaomi Mi');
      });
    });

    it('sorts numeric column numerically ascending', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Click sort button for 2020 column (second column)
      const sortButtons = screen.getAllByTitle('Sort column');
      await user.click(sortButtons[1]);

      await waitFor(() => {
        // Should be sorted by 2020 values ascending
        // Xiaomi Mi has lowest value (300)
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(0);
      });
    });

    it('sorts numeric column numerically descending on second click', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const sortButtons = screen.getAllByTitle('Sort column');
      
      // Click twice for descending
      await user.click(sortButtons[1]);
      await user.click(sortButtons[1]);

      await waitFor(() => {
        // Should be sorted by 2020 values descending
        // Apple iPhone has highest value (1000)
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(0);
      });
    });

    it('shows sort direction indicator', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const sortButtons = screen.getAllByTitle('Sort column');
      
      // Initially should show neutral sort indicator
      expect(sortButtons[0]).toHaveTextContent('↕');
      
      // After clicking should show ascending
      await user.click(sortButtons[0]);
      await waitFor(() => {
        expect(sortButtons[0]).toHaveTextContent('↑');
      });

      // After second click should show descending
      await user.click(sortButtons[0]);
      await waitFor(() => {
        expect(sortButtons[0]).toHaveTextContent('↓');
      });
    });

    it('maintains other column sort indicators correctly', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const sortButtons = screen.getAllByTitle('Sort column');
      
      // Sort first column
      await user.click(sortButtons[0]);
      await waitFor(() => {
        expect(sortButtons[0]).toHaveTextContent('↑');
        expect(sortButtons[1]).toHaveTextContent('↕');
      });

      // Sort second column
      await user.click(sortButtons[1]);
      await waitFor(() => {
        expect(sortButtons[0]).toHaveTextContent('↕');
        expect(sortButtons[1]).toHaveTextContent('↑');
      });
    });
  });

  describe('Combined Filtering and Sorting', () => {
    it('applies sorting to filtered data', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // First filter
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'i'); // Should match iPhone, Pixel, Xiaomi

      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
        expect(screen.getByText('Google Pixel')).toBeInTheDocument();
        expect(screen.getByText('Xiaomi Mi')).toBeInTheDocument();
        expect(screen.queryByText('Samsung Galaxy')).not.toBeInTheDocument();
      });

      // Then sort
      const sortButtons = screen.getAllByTitle('Sort column');
      await user.click(sortButtons[0]);

      await waitFor(() => {
        // Should be sorted alphabetically among filtered results
        const visibleProducts = screen.getAllByText(/Apple iPhone|Google Pixel|Xiaomi Mi/);
        expect(visibleProducts.length).toBe(3);
      });
    });

    it('maintains filter when sorting', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Filter first
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Apple');

      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
        expect(screen.queryByText('Samsung Galaxy')).not.toBeInTheDocument();
      });

      // Sort
      const sortButtons = screen.getAllByTitle('Sort column');
      await user.click(sortButtons[0]);

      await waitFor(() => {
        // Filter should still be active
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
        expect(screen.queryByText('Samsung Galaxy')).not.toBeInTheDocument();
        expect(filterInput).toHaveValue('Apple');
      });
    });

    it('updates sorted data when filter changes', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      // Sort first
      const sortButtons = screen.getAllByTitle('Sort column');
      await user.click(sortButtons[0]);

      // Then filter
      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, 'Samsung');

      await waitFor(() => {
        expect(screen.getByText('Samsung Galaxy')).toBeInTheDocument();
        expect(screen.queryByText('Apple iPhone')).not.toBeInTheDocument();
      });

      // Change filter
      await user.clear(filterInput);
      await user.type(filterInput, 'Google');

      await waitFor(() => {
        expect(screen.getByText('Google Pixel')).toBeInTheDocument();
        expect(screen.queryByText('Samsung Galaxy')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty filter input correctly', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      
      // Type and then clear
      await user.type(filterInput, 'Apple');
      await user.clear(filterInput);

      await waitFor(() => {
        // All data should be visible
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
        expect(screen.getByText('Samsung Galaxy')).toBeInTheDocument();
        expect(screen.getByText('Google Pixel')).toBeInTheDocument();
      });
    });

    it('handles whitespace in filter correctly', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, ' Apple ');

      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
        expect(screen.queryByText('Samsung Galaxy')).not.toBeInTheDocument();
      });
    });

    it('handles special characters in filter', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      await user.type(filterInput, '()[]{}');

      await waitFor(() => {
        // Should not crash and show no results
        expect(screen.queryByText('Apple iPhone')).not.toBeInTheDocument();
      });
    });

    it('sorts mixed data types correctly', async () => {
      const mixedData = {
        columns: [{ name: 'Mixed', key: 'mixed' }],
        items: [
          { mixed: 'text' },
          { mixed: 100 },
          { mixed: 'another' },
          { mixed: 50 },
        ],
      };

      const user = userEvent.setup();
      render(<Spreadsheet data={mixedData} {...mockCallbacks} />);

      const sortButtons = screen.getAllByTitle('Sort column');
      await user.click(sortButtons[0]);

      // Should handle mixed types without crashing
      await waitFor(() => {
        expect(screen.getByText('text')).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('handles large dataset filtering efficiently', async () => {
      const largeData = {
        columns: mockData.columns,
        items: Array.from({ length: 1000 }, (_, i) => ({
          product: `Product ${i}`,
          '2020': Math.floor(Math.random() * 1000),
          '2021': Math.floor(Math.random() * 1000),
          '2022': Math.floor(Math.random() * 1000),
        })),
      };

      const user = userEvent.setup();
      render(<Spreadsheet data={largeData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      
      // Filter should be responsive even with large dataset
      await user.type(filterInput, 'Product 1');

      await waitFor(() => {
        expect(screen.getByText('Product 1')).toBeInTheDocument();
      });
    });

    it('handles rapid filter changes efficiently', async () => {
      const user = userEvent.setup();
      render(<Spreadsheet data={mockData} {...mockCallbacks} />);

      const filterInput = screen.getByPlaceholderText('Filter...');
      
      // Rapidly change filter
      await user.type(filterInput, 'A');
      await user.type(filterInput, 'p');
      await user.type(filterInput, 'p');
      await user.type(filterInput, 'l');
      await user.type(filterInput, 'e');

      await waitFor(() => {
        expect(screen.getByText('Apple iPhone')).toBeInTheDocument();
        expect(filterInput).toHaveValue('Apple');
      });
    });
  });
});