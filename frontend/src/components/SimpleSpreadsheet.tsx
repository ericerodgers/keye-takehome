'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a single cell in the spreadsheet
 * @property value - The cell's content (string)
 * @property isBold - Whether the text is bold
 * @property isItalic - Whether the text is italic
 * @property isNumeric - Whether the value should be treated as a number
 */
interface Cell {
  value: string;
  isBold: boolean;
  isItalic: boolean;
  isNumeric: boolean;
}

/**
 * Represents a selection range in the spreadsheet
 * @property startRow - Starting row index (inclusive)
 * @property startCol - Starting column index (inclusive)
 * @property endRow - Ending row index (inclusive)
 * @property endCol - Ending column index (inclusive)
 */
interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Number of rows in the spreadsheet */
const ROWS = 13;
/** Number of columns in the spreadsheet */
const COLS = 6;
/** Width of each column in pixels */
const COL_WIDTH = 120;
/** Height of each row in pixels */
const ROW_HEIGHT = 40;

// ============================================================================
// SAMPLE DATA
// ============================================================================

/**
 * Sample data for demonstration purposes
 * Contains a header row and three data rows with quarterly revenue data
 */
const SAMPLE_DATA: Cell[][] = [
  // Header row
  [
    { value: 'Product', isBold: true, isItalic: false, isNumeric: false },
    { value: 'Q1', isBold: true, isItalic: false, isNumeric: false },
    { value: 'Q2', isBold: true, isItalic: false, isNumeric: false },
    { value: 'Q3', isBold: true, isItalic: false, isNumeric: false },
    { value: 'Q4', isBold: true, isItalic: false, isNumeric: false },
    { value: 'Total', isBold: true, isItalic: false, isNumeric: false }
  ],
  // Data rows
  [
    { value: 'Widget A', isBold: false, isItalic: false, isNumeric: false },
    { value: '100', isBold: false, isItalic: false, isNumeric: true },
    { value: '150', isBold: false, isItalic: false, isNumeric: true },
    { value: '200', isBold: false, isItalic: false, isNumeric: true },
    { value: '175', isBold: false, isItalic: false, isNumeric: true },
    { value: '', isBold: false, isItalic: false, isNumeric: false }
  ],
  [
    { value: 'Widget B', isBold: false, isItalic: false, isNumeric: false },
    { value: '75', isBold: false, isItalic: false, isNumeric: true },
    { value: '125', isBold: false, isItalic: false, isNumeric: true },
    { value: '180', isBold: false, isItalic: false, isNumeric: true },
    { value: '220', isBold: false, isItalic: false, isNumeric: true },
    { value: '', isBold: false, isItalic: false, isNumeric: false }
  ],
  [
    { value: 'Widget C', isBold: false, isItalic: false, isNumeric: false },
    { value: '50', isBold: false, isItalic: false, isNumeric: true },
    { value: '100', isBold: false, isItalic: false, isNumeric: true },
    { value: '150', isBold: false, isItalic: false, isNumeric: true },
    { value: '200', isBold: false, isItalic: false, isNumeric: true },
    { value: '', isBold: false, isItalic: false, isNumeric: false }
  ]
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Simple Spreadsheet Component
 * 
 * A basic spreadsheet implementation with the following features:
 * - Cell selection and editing
 * - Range selection with Shift+click
 * - Sorting by column
 * - Filtering by column
 * - Basic formatting (bold, italic)
 * - Context menu for additional operations
 * - Keyboard shortcuts
 * - Sample data with quarterly revenue analysis
 * 
 * This is a simpler alternative to the main Spreadsheet component,
 * suitable for basic data entry and analysis tasks.
 */
export default function SimpleSpreadsheet() {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  /** Main data array - 2D grid of cells */
  const [data, setData] = useState<Cell[][]>(() => {
    // Initialize with sample data and fill remaining rows with empty cells
    const initialData = [...SAMPLE_DATA];
    while (initialData.length < ROWS) {
      initialData.push(
        Array(COLS).fill(null).map(() => ({
          value: '',
          isBold: false,
          isItalic: false,
          isNumeric: false
        }))
      );
    }
    return initialData;
  });
  
  /** Currently selected range of cells */
  const [selection, setSelection] = useState<Selection | null>(null);
  
  /** Cell currently being edited (null if not editing) */
  const [editingCell, setEditingCell] = useState<{row: number, col: number} | null>(null);
  
  /** Current value being edited */
  const [editValue, setEditValue] = useState('');
  
  /** Last clicked cell for range selection */
  const [lastClickedCell, setLastClickedCell] = useState<{row: number, col: number} | null>(null);
  
  /** Column currently being sorted (null if no sorting) */
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  
  /** Sort direction (ascending or descending) */
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  /** Filter values for each column */
  const [filters, setFilters] = useState<string[]>(Array(COLS).fill(''));
  
  /** Whether to show filter inputs */
  const [showFilters, setShowFilters] = useState(false);
  
  /** Whether to show keyboard shortcuts help */
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  
  /** Context menu state (position and target cell) */
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, row: number, col: number} | null>(null);
  
  // ============================================================================
  // REFS
  // ============================================================================
  
  /** Reference to the main table container */
  const tableRef = useRef<HTMLDivElement>(null);
  
  /** Reference to the edit input field */
  const editInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  /**
   * Convert column index to Excel-style letter (0=A, 1=B, etc.)
   * @param col - Column index
   * @returns Column letter
   */
  const getColumnLetter = (col: number) => String.fromCharCode(65 + col);

  /**
   * Get filtered and sorted data for display
   * Applies both filters and sorting to the raw data
   * @returns Processed data ready for rendering
   */
  const getDisplayData = () => {
    let filteredData = [...data];
    
    // Apply filters - filter rows that match any non-empty filter
    const hasFilters = filters.some(filter => filter.trim() !== '');
    if (hasFilters) {
      filters.forEach((filter, colIndex) => {
        if (filter.trim()) {
          filteredData = filteredData.filter(row => 
            row[colIndex].value.toLowerCase().includes(filter.toLowerCase())
          );
        }
      });
    }
    
    // Apply sorting - sort by the selected column
    if (sortColumn !== null) {
      filteredData.sort((a, b) => {
        const aVal = a[sortColumn].value;
        const bVal = b[sortColumn].value;
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        
        // Try numeric sorting first, fall back to string sorting
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    
    return filteredData;
  };

  /** Processed data ready for rendering */
  const displayData = getDisplayData();

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  /**
   * Handle cell click events
   * Supports single cell selection and range selection with Shift+click
   * @param row - Row index of clicked cell
   * @param col - Column index of clicked cell
   * @param event - Mouse event
   */
  const handleCellClick = (row: number, col: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastClickedCell) {
      // Range selection: select from last clicked cell to current cell
      const startRow = Math.min(lastClickedCell.row, row);
      const endRow = Math.max(lastClickedCell.row, row);
      const startCol = Math.min(lastClickedCell.col, col);
      const endCol = Math.max(lastClickedCell.col, col);
      setSelection({ startRow, startCol, endRow, endCol });
    } else {
      // Single cell selection
      setSelection({ startRow: row, startCol: col, endRow: row, endCol: col });
      setLastClickedCell({ row, col });
    }
    setEditingCell(null);
    setContextMenu(null);
  };

  /**
   * Handle cell right-click to show context menu
   * @param row - Row index of right-clicked cell
   * @param col - Column index of right-clicked cell
   * @param event - Mouse event
   */
  const handleCellRightClick = (row: number, col: number, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, row, col });
    if (!selection || selection.startRow !== row || selection.startCol !== col) {
      setSelection({ startRow: row, startCol: col, endRow: row, endCol: col });
      setLastClickedCell({ row, col });
    }
  };

  /**
   * Handle cell double-click to enter edit mode
   * @param row - Row index of double-clicked cell
   * @param col - Column index of double-clicked cell
   */
  const handleCellDoubleClick = (row: number, col: number) => {
    setEditingCell({ row, col });
    setEditValue(data[row][col].value);
  };

  /**
   * Handle edit input value changes
   * @param e - Input change event
   */
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditValue(value);
  };

  /**
   * Handle edit input keyboard events
   * Enter: complete edit, Escape: cancel edit
   * @param e - Keyboard event
   */
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditComplete();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  /**
   * Complete the current cell edit
   * Updates the cell value and determines if it's numeric
   */
  const handleEditComplete = () => {
    if (editingCell) {
      const newData = [...data];
      const cell = { ...newData[editingCell.row][editingCell.col] };
      cell.value = editValue;
      cell.isNumeric = !isNaN(parseFloat(editValue)) && editValue !== '';
      newData[editingCell.row][editingCell.col] = cell;
      setData(newData);
      setEditingCell(null);
    }
  };

  // Handle row header click
  const handleRowHeaderClick = (row: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastClickedCell) {
      const startRow = Math.min(lastClickedCell.row, row);
      const endRow = Math.max(lastClickedCell.row, row);
      setSelection({ startRow, startCol: 0, endRow, endCol: COLS - 1 });
    } else {
      setSelection({ startRow: row, startCol: 0, endRow: row, endCol: COLS - 1 });
      setLastClickedCell({ row, col: 0 });
    }
  };

  // Handle sort
  const handleSort = (col: number) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  };

  // Handle filter change
  const handleFilterChange = (col: number, value: string) => {
    const newFilters = [...filters];
    newFilters[col] = value;
    setFilters(newFilters);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters(Array(COLS).fill(''));
  };

  // Clear sorting
  const clearSorting = () => {
    setSortColumn(null);
    setSortDirection('asc');
  };

  // Calculate SUM
  const calculateSum = () => {
    if (!selection) return;
    
    let sum = 0;
    let count = 0;
    
    for (let row = selection.startRow; row <= selection.endRow; row++) {
      for (let col = selection.startCol; col <= selection.endCol; col++) {
        const cell = data[row][col];
        if (cell.isNumeric) {
          sum += parseFloat(cell.value);
          count++;
        }
      }
    }
    
    if (count > 0) {
      const resultRow = Math.max(selection.endRow + 1, ROWS - 1);
      const resultCol = selection.startCol;
      
      const newData = [...data];
      if (resultRow >= newData.length) {
        newData.push(Array(COLS).fill(null).map(() => ({
          value: '',
          isBold: false,
          isItalic: false,
          isNumeric: false
        })));
      }
      
      newData[resultRow][resultCol] = {
        value: sum.toString(),
        isBold: true,
        isItalic: false,
        isNumeric: true
      };
      
      setData(newData);
    }
  };

  // Calculate AVERAGE
  const calculateAverage = () => {
    if (!selection) return;
    
    let sum = 0;
    let count = 0;
    
    for (let row = selection.startRow; row <= selection.endRow; row++) {
      for (let col = selection.startCol; col <= selection.endCol; col++) {
        const cell = data[row][col];
        if (cell.isNumeric) {
          sum += parseFloat(cell.value);
          count++;
        }
      }
    }
    
    if (count > 0) {
      const resultRow = Math.max(selection.endRow + 1, ROWS - 1);
      const resultCol = selection.startCol;
      
      const newData = [...data];
      if (resultRow >= newData.length) {
        newData.push(Array(COLS).fill(null).map(() => ({
          value: '',
          isBold: false,
          isItalic: false,
          isNumeric: false
        })));
      }
      
      newData[resultRow][resultCol] = {
        value: (sum / count).toFixed(2),
        isBold: true,
        isItalic: false,
        isNumeric: true
      };
      
      setData(newData);
    }
  };

  // Toggle bold
  const toggleBold = () => {
    if (!selection) return;
    
    const newData = [...data];
    for (let row = selection.startRow; row <= selection.endRow; row++) {
      for (let col = selection.startCol; col <= selection.endCol; col++) {
        newData[row][col] = { ...newData[row][col], isBold: !newData[row][col].isBold };
      }
    }
    setData(newData);
  };

  // Toggle italic
  const toggleItalic = () => {
    if (!selection) return;
    
    const newData = [...data];
    for (let row = selection.startRow; row <= selection.endRow; row++) {
      for (let col = selection.startCol; col <= selection.endCol; col++) {
        newData[row][col] = { ...newData[row][col], isItalic: !newData[row][col].isItalic };
      }
    }
    setData(newData);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if ((target as HTMLInputElement).placeholder?.includes('Filter') || editingCell) return;

    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          toggleBold();
          break;
        case 'i':
          e.preventDefault();
          toggleItalic();
          break;
      }
    } else {
      switch (e.key) {
        case 'Enter':
        case 'F2':
          e.preventDefault();
          if (selection && !editingCell) {
            setEditingCell({ row: selection.startRow, col: selection.startCol });
            setEditValue(data[selection.startRow][selection.startCol].value);
          }
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (selection) {
            const newData = [...data];
            for (let row = selection.startRow; row <= selection.endRow; row++) {
              for (let col = selection.startCol; col <= selection.endCol; col++) {
                newData[row][col] = { ...newData[row][col], value: '' };
              }
            }
            setData(newData);
          }
          break;
      }
    }
  }, [selection, editingCell, data]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Handle click outside to stop editing and close context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingCell && !(event.target as Element).closest('.edit-input')) {
        handleEditComplete();
      }
      setContextMenu(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingCell]);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={calculateSum}
                disabled={!selection}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                SUM
              </button>
              <button
                onClick={calculateAverage}
                disabled={!selection}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                AVERAGE
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={toggleBold}
                disabled={!selection}
                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Bold
              </button>
              <button
                onClick={toggleItalic}
                disabled={!selection}
                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Italic
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </button>
              <button
                onClick={clearFilters}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear Filters
              </button>
              <button
                onClick={clearSorting}
                className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                Clear Sort
              </button>
            </div>
            
            <button
              onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
              className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800"
            >
              Keyboard Shortcuts
            </button>
          </div>
          
          {showKeyboardHelp && (
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
              <h4 className="font-semibold mb-2">Keyboard Shortcuts:</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>Enter/F2: Edit cell</div>
                <div>Delete/Backspace: Clear selection</div>
                <div>Ctrl+B: Bold</div>
                <div>Ctrl+I: Italic</div>
                <div>Shift+Click: Multi-select</div>
              </div>
            </div>
          )}
        </div>

        {/* Spreadsheet */}
        <div 
          ref={tableRef}
          className="bg-white rounded-lg shadow-sm overflow-auto"
          style={{ 
            minWidth: COLS * COL_WIDTH + 50,
            maxHeight: 'calc(100vh - 200px)'
          }}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <table className="border-collapse w-full">
            <thead>
              <tr>
                <th className="w-12 h-10 bg-gray-100 border border-gray-300"></th>
                {Array.from({ length: COLS }, (_, col) => (
                  <th key={col} className="relative">
                    <div className="flex items-center justify-between p-2 bg-gray-100 border border-gray-300 min-w-[120px]">
                      <span className="font-semibold">{getColumnLetter(col)}</span>
                      <button
                        onClick={() => handleSort(col)}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                      >
                        {sortColumn === col ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                      </button>
                    </div>
                    {showFilters && (
                      <input
                        type="text"
                        placeholder={`Filter ${getColumnLetter(col)}`}
                        value={filters[col]}
                        onChange={(e) => handleFilterChange(col, e.target.value)}
                        className="w-full p-1 text-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Render column header row as first row in tbody */}
              <tr>
                <td className={`w-12 h-10 bg-gray-100 border border-gray-300 text-center font-semibold`}>#</td>
                {Array.from({ length: COLS }, (_, colIndex) => {
                  const isSelected = selection && selection.startRow === 0 && selection.startCol <= colIndex && selection.endCol >= colIndex;
                  return (
                    <td
                      key={colIndex}
                      className={`border border-gray-300 p-0 relative ${isSelected ? 'bg-blue-200 ring-2 ring-blue-600 z-10' : ''}`}
                      style={{ minWidth: COL_WIDTH, height: ROW_HEIGHT }}
                      onClick={e => handleCellClick(0, colIndex, e)}
                    >
                      <div className="w-full h-full p-2 flex items-center font-semibold justify-center">
                        {getColumnLetter(colIndex)}
                      </div>
                    </td>
                  );
                })}
              </tr>
              {/* Render data rows, shifting index by 1 */}
              {displayData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td
                    className={`w-12 h-10 bg-gray-100 border border-gray-300 text-center font-semibold cursor-pointer hover:bg-gray-200`}
                    onClick={(e) => handleRowHeaderClick(rowIndex + 1, e)}
                  >
                    {rowIndex + 1}
                  </td>
                  {row.map((cell, colIndex) => {
                    const isSelected = selection && 
                      (rowIndex + 1) >= selection.startRow && (rowIndex + 1) <= selection.endRow &&
                      colIndex >= selection.startCol && colIndex <= selection.endCol;
                    const isEditing = editingCell && 
                      editingCell.row === (rowIndex + 1) && editingCell.col === colIndex;
                    return (
                      <td
                        key={colIndex}
                        className={`border border-gray-300 p-0 relative ${
                          isSelected ? 'bg-blue-200 ring-2 ring-blue-600 z-10' : ''
                        }`}
                        style={{ minWidth: COL_WIDTH, height: ROW_HEIGHT }}
                        onClick={(e) => handleCellClick(rowIndex + 1, colIndex, e)}
                        onDoubleClick={() => handleCellDoubleClick(rowIndex + 1, colIndex)}
                        onContextMenu={(e) => handleCellRightClick(rowIndex + 1, colIndex, e)}
                      >
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={handleEditChange}
                            onKeyDown={handleEditKeyDown}
                            onBlur={handleEditComplete}
                            className="w-full h-full p-2 border-none outline-none edit-input"
                          />
                        ) : (
                          <div className={`w-full h-full p-2 flex items-center ${
                            cell.isBold ? 'font-bold' : ''
                          } ${cell.isItalic ? 'italic' : ''}`}>
                            {cell.value}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-white border border-gray-300 rounded shadow-lg z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="py-1">
              <button
                onClick={() => {
                  if (contextMenu) {
                    setEditingCell({ row: contextMenu.row, col: contextMenu.col });
                    setEditValue(data[contextMenu.row][contextMenu.col].value);
                  }
                  setContextMenu(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (contextMenu) {
                    const newData = [...data];
                    newData[contextMenu.row][contextMenu.col] = { ...newData[contextMenu.row][contextMenu.col], value: '' };
                    setData(newData);
                  }
                  setContextMenu(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  if (contextMenu) {
                    const newData = [...data];
                    newData[contextMenu.row][contextMenu.col] = { ...newData[contextMenu.row][contextMenu.col], isBold: !newData[contextMenu.row][contextMenu.col].isBold };
                    setData(newData);
                  }
                  setContextMenu(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                Toggle Bold
              </button>
              <button
                onClick={() => {
                  if (contextMenu) {
                    const newData = [...data];
                    newData[contextMenu.row][contextMenu.col] = { ...newData[contextMenu.row][contextMenu.col], isItalic: !newData[contextMenu.row][contextMenu.col].isItalic };
                    setData(newData);
                  }
                  setContextMenu(null);
                }}
                className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                Toggle Italic
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 