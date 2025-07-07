'use client';

import { useState, useEffect } from 'react';
import Spreadsheet from '../components/Spreadsheet';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a column in the spreadsheet data
 * @property name - Display name for the column
 * @property key - Unique identifier used to access data in rows
 */
type Column = { name: string; key: string };

/**
 * Represents a row of data as key-value pairs
 * Keys correspond to column keys, values can be strings or numbers
 */
type Row = Record<string, string | number>;

/**
 * Main data structure for the spreadsheet
 * @property columns - Array of column definitions
 * @property items - Array of row data objects
 */
type TableData = {
  columns: Column[];
  items: Row[];
};

/**
 * Expected structure of the API response
 * @property Values - The main table data
 */
type ApiResponse = {
  Values: TableData;
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

/**
 * Home Page Component
 * 
 * Main entry point for the spreadsheet application. This component:
 * - Fetches data from the backend API
 * - Handles loading and error states
 * - Manages data updates for column operations
 * - Renders the main Spreadsheet component
 * 
 * The component communicates with a backend server running on port 4000
 * to fetch the initial spreadsheet data and handles various data
 * manipulation operations like column reordering, insertion, and renaming.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Home() {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  /** Main spreadsheet data from the API */
  const [data, setData] = useState<TableData | null>(null);
  
  /** Loading state while fetching data */
  const [loading, setLoading] = useState(true);
  
  /** Error state if data fetching fails */
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================
  
  /**
   * Fetch spreadsheet data from the backend API
   * Called once when the component mounts
   */
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(API_URL + '/api/data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const apiData: ApiResponse = await response.json();
        setData(apiData.Values);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading spreadsheet data...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error Loading Data</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Make sure the backend server is running on port 4000</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // NO DATA STATE
  // ============================================================================
  
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // DATA UPDATE HANDLERS
  // ============================================================================
  
  /**
   * Handle column header name changes
   * Updates the display name of a column
   * @param columnIndex - Index of the column to update
   * @param newName - New name for the column
   */
  const handleHeaderChange = (columnIndex: number, newName: string) => {
    setData(prevData => {
      if (!prevData) return prevData;
      const newColumns = [...prevData.columns];
      newColumns[columnIndex] = { ...newColumns[columnIndex], name: newName };
      return { ...prevData, columns: newColumns };
    });
  };

  /**
   * Handle adding new columns to the spreadsheet
   * Adds columns to the end and initializes them with empty values
   * @param newColumns - Array of new column definitions to add
   */
  const handleAddColumns = (newColumns: {name: string, key: string}[]) => {
    setData(prevData => {
      if (!prevData) return prevData;
      return {
        ...prevData,
        columns: [...prevData.columns, ...newColumns],
        items: prevData.items.map(item => {
          const newItem = { ...item };
          newColumns.forEach(col => {
            newItem[col.key] = '';
          });
          return newItem;
        })
      };
    });
  };

  /**
   * Handle inserting a new column at a specific position
   * Inserts the column and initializes all rows with empty values
   * @param index - Position where to insert the new column
   * @param column - Column definition to insert
   */
  const handleInsertColumn = (index: number, column: {name: string, key: string}) => {
    setData(prevData => {
      if (!prevData) return prevData;
      
      // Insert column at specified index
      const newColumns = [...prevData.columns];
      newColumns.splice(index, 0, column);
      
      return {
        ...prevData,
        columns: newColumns,
        items: prevData.items.map(item => {
          const newItem = { ...item };
          newItem[column.key] = '';
          return newItem;
        })
      };
    });
  };

  /**
   * Handle reordering columns via drag and drop
   * Moves a column from source index to target index
   * @param sourceIndex - Original position of the column
   * @param targetIndex - New position for the column
   */
  const handleReorderColumns = (sourceIndex: number, targetIndex: number) => {
    setData(prevData => {
      if (!prevData) return prevData;
      
      // Reorder columns
      const newColumns = [...prevData.columns];
      const [draggedCol] = newColumns.splice(sourceIndex, 1);
      newColumns.splice(targetIndex, 0, draggedCol);
      
      return {
        ...prevData,
        columns: newColumns
      };
    });
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  return     <Spreadsheet 
      data={data} 
      onHeaderChange={handleHeaderChange} 
      onAddColumns={handleAddColumns} 
      onInsertColumn={handleInsertColumn} 
      onReorderColumns={handleReorderColumns} 
    />;
}
