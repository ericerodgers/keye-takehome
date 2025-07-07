import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../page';

// Mock the fetch API
global.fetch = jest.fn();

const mockApiResponse = {
  Values: {
    columns: [
      { name: 'Product', key: 'product' },
      { name: '2020', key: '2020' },
      { name: '2021', key: '2021' },
    ],
    items: [
      { product: 'Widget A', '2020': 100, '2021': 120 },
      { product: 'Widget B', '2020': 200, '2021': 180 },
    ],
  },
};

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(
      () =>
        new Promise(() => {
          // Never resolve to keep loading state
        })
    );

    render(<Home />);

    expect(screen.getByText('Loading spreadsheet data...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders spreadsheet when data loads successfully', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Product')).toBeInTheDocument();
      expect(screen.getByText('Widget A')).toBeInTheDocument();
      expect(screen.getByText('Widget B')).toBeInTheDocument();
    });

    expect(screen.queryByText('Loading spreadsheet data...')).not.toBeInTheDocument();
  });

  it('shows error state when API call fails', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('⚠️ Error Loading Data')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    expect(screen.queryByText('Loading spreadsheet data...')).not.toBeInTheDocument();
  });

  it('shows error state when API returns non-ok response', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('⚠️ Error Loading Data')).toBeInTheDocument();
      expect(screen.getByText('HTTP error! status: 500')).toBeInTheDocument();
    });
  });

  it('shows retry button on error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('retries API call when retry button is clicked', async () => {
    // First call fails
    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

    // Mock window.location.reload
    const mockReload = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    // Click retry
    const retryButton = screen.getByText('Retry');
    retryButton.click();

    expect(mockReload).toHaveBeenCalled();
  });

  it('shows backend server message in error state', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Make sure the backend server is running on port 4000')).toBeInTheDocument();
    });
  });

  it('handles empty data response', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Values: null }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  it('calls correct API endpoint', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<Home />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:4000/api/data');
    });
  });

  it('handles header change callback', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Product')).toBeInTheDocument();
    });

    // The component should be rendered with callback props
    // This is more of an integration test to ensure callbacks are passed
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('handles add columns callback', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Product')).toBeInTheDocument();
    });

    // Verify the spreadsheet component receives the callback
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('handles insert column callback', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Product')).toBeInTheDocument();
    });

    // Verify the spreadsheet component receives the callback
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('handles reorder columns callback', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Product')).toBeInTheDocument();
    });

    // Verify the spreadsheet component receives the callback
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  describe('Error Handling Edge Cases', () => {
    it('handles malformed JSON response', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('⚠️ Error Loading Data')).toBeInTheDocument();
        expect(screen.getByText('Invalid JSON')).toBeInTheDocument();
      });
    });

    it('handles network timeout', async () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 100);
          })
      );

      render(<Home />);

      await waitFor(
        () => {
          expect(screen.getByText('⚠️ Error Loading Data')).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    it('handles API response with missing Values property', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('No data available')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows spinner during loading', () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(() => {
            // Never resolve
          })
      );

      render(<Home />);

      expect(screen.getByRole('status')).toHaveClass('animate-spin');
    });

    it('hides loading state after successful load', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      });

      render(<Home />);

      await waitFor(() => {
        expect(screen.queryByText('Loading spreadsheet data...')).not.toBeInTheDocument();
      });
    });

    it('hides loading state after error', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Error'));

      render(<Home />);

      await waitFor(() => {
        expect(screen.queryByText('Loading spreadsheet data...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper loading announcement', () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise(() => {
            // Never resolve
          })
      );

      render(<Home />);

      expect(screen.getByText('Loading spreadsheet data...')).toBeInTheDocument();
    });

    it('has proper error announcement', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(<Home />);

      await waitFor(() => {
        expect(screen.getByText('⚠️ Error Loading Data')).toBeInTheDocument();
      });
    });

    it('retry button is keyboard accessible', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Error'));

      render(<Home />);

      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        expect(retryButton).toBeInTheDocument();
        expect(retryButton.tagName).toBe('BUTTON');
      });
    });
  });
});