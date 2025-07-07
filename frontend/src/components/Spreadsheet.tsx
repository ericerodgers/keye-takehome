'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import clsx from 'clsx';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a column in the spreadsheet with a display name and unique key
 * @property name - The display name shown in the header
 * @property key - The unique identifier used to access data in rows
 */
type Column = { name: string; key: string };

/**
 * Represents a row of data as a key-value mapping
 * Keys correspond to column keys, values can be strings or numbers
 */
type Row = Record<string, string | number>;

/**
 * The main data structure passed to the Spreadsheet component
 * @property columns - Array of column definitions
 * @property items - Array of row data objects
 */
type TableData = {
  columns: Column[];
  items: Row[];
};

/**
 * Represents a cell position using zero-based row and column indices
 * Used for selection, editing, and navigation
 */
type CellPosition = { row: number; col: number };

/**
 * Represents a range of cells from start to end position
 * Used for multi-cell selection and operations
 */
type CellRange = { start: CellPosition; end: CellPosition };

/**
 * Defines the visual formatting options for a cell
 * @property bold - Whether text should be bold
 * @property italic - Whether text should be italic
 * @property alignment - Text alignment within the cell
 * @property backgroundColor - Background color of the cell
 */
type CellFormat = {
  bold?: boolean;
  italic?: boolean;
  alignment?: 'left' | 'center' | 'right';
  backgroundColor?: string;
};

/**
 * Represents the complete data for a single cell
 * @property value - The actual value (string or number)
 * @property format - Visual formatting options
 * @property formula - Excel-like formula (e.g., "=SUM(A1:A10)")
 */
type CellData = {
  value: string | number;
  format?: CellFormat;
  formula?: string;
};

/**
 * Props interface for the Spreadsheet component
 * @property data - The table data to display
 * @property onHeaderChange - Callback when column headers are renamed
 * @property onAddColumns - Callback when new columns are added
 * @property onInsertColumn - Callback when a column is inserted at a specific position
 * @property onReorderColumns - Callback when columns are reordered
 */
type Props = {
  data: TableData;
  onHeaderChange?: (columnIndex: number, newName: string) => void;
  onAddColumns?: (newColumns: {name: string, key: string}[]) => void;
  onInsertColumn?: (index: number, column: {name: string, key: string}) => void;
  onReorderColumns?: (sourceIndex: number, targetIndex: number) => void;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Advanced React Spreadsheet Component
 * 
 * Features:
 * - Virtual scrolling for large datasets (1000+ rows)
 * - Real-time filtering and sorting
 * - Multi-cell selection with keyboard shortcuts
 * - Drag and drop for columns and rows
 * - Excel-like formulas (SUM, AVERAGE, COUNT, MAX, MIN)
 * - Cell formatting (bold, italic, alignment)
 * - Undo/Redo functionality
 * - Column and row resizing
 * - Context menus for insert operations
 * 
 * Performance optimizations:
 * - Only renders visible rows for large datasets
 * - Debounced filtering to prevent excessive re-renders
 * - Memoized calculations for sorting and filtering
 * - Efficient cell reference parsing and formula evaluation
 */
const Spreadsheet: React.FC<Props> = ({ data, onHeaderChange, onAddColumns, onInsertColumn, onReorderColumns }) => {
  // ============================================================================
  // SELECTION STATE
  // ============================================================================
  
  /** Currently selected cell (primary selection) */
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  
  /** Currently selected range of cells (for multi-cell operations) */
  const [selectedRange, setSelectedRange] = useState<CellRange | null>(null);
  
  /** Set of all selected cell keys in format "row,col" (supports multi-select) */
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  
  /** Cell currently being edited (double-clicked) */
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);

  // ============================================================================
  // SPREADSHEET DATA STATE
  // ============================================================================
  
  /** 2D array of cell data (rows x columns) - the main data structure */
  const [gridData, setGridData] = useState<CellData[][]>(() => {
    // Initialize from props data, converting to CellData format
    return data.items.map(row => 
      data.columns.map(col => ({
        value: row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '',
        format: {}
      }))
    );
  });
  
  /** Width of each column in pixels - supports custom column widths */
  const [columnWidths, setColumnWidths] = useState<number[]>(() => {
    return Array(data.columns.length).fill(150); // Default 150px width
  });
  
  /** Height of each row in pixels - supports custom row heights */
  const [rowHeights, setRowHeights] = useState<number[]>(() => 
    Array(data.items.length).fill(40) // Default 40px height
  );

  // ============================================================================
  // DRAG AND DROP STATE
  // ============================================================================
  
  /** Whether a drag operation is currently in progress */
  const [isDragging, setIsDragging] = useState(false);
  
  /** Starting position of the current drag operation */
  const [dragStart, setDragStart] = useState<CellPosition | null>(null);

  // ============================================================================
  // UNDO/REDO HISTORY STATE
  // ============================================================================
  
  /** Structure for storing historical states */
  type HistoryState = {
    gridData: CellData[][];
    columns: Column[];
  };
  
  /** Stack of previous states for undo/redo functionality */
  const [history, setHistory] = useState<HistoryState[]>([]);
  
  /** Current position in the history stack */
  const [historyIndex, setHistoryIndex] = useState(-1);

  // ============================================================================
  // SORTING AND FILTERING STATE
  // ============================================================================
  
  /** Index of the column currently being sorted (null = no sorting) */
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  
  /** Direction of sorting (ascending or descending) */
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  /** Current filter text input by user */
  const [filterText, setFilterText] = useState('');
  
  /** Debounced version of filter text to prevent excessive re-renders */
  const [debouncedFilterText, setDebouncedFilterText] = useState('');

  // ============================================================================
  // COLUMN/ROW RESIZING STATE
  // ============================================================================
  
  /** Index of column currently being resized (null = not resizing) */
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  
  /** X position where column resize started */
  const [resizeStartX, setResizeStartX] = useState(0);
  
  /** Initial width of column being resized */
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  
  /** Index of row currently being resized (null = not resizing) */
  const [resizingRow, setResizingRow] = useState<number | null>(null);
  
  /** Y position where row resize started */
  const [resizeStartY, setResizeStartY] = useState(0);
  
  /** Initial height of row being resized */
  const [resizeStartHeight, setResizeStartHeight] = useState(0);
  
  /** Flag to prevent click events immediately after resize */
  const [justFinishedResize, setJustFinishedResize] = useState(false);

  // ============================================================================
  // HEADER EDITING STATE
  // ============================================================================
  
  /** Index of header currently being edited (null = not editing) */
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  
  /** Current value being edited in the header input */
  const [headerEditValue, setHeaderEditValue] = useState('');

  // ============================================================================
  // DRAG AND DROP (COLUMNS/ROWS) STATE
  // ============================================================================
  
  /** Index of column being dragged for reordering */
  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  
  /** Index of row being dragged for reordering */
  const [draggedRow, setDraggedRow] = useState<number | null>(null);
  
  /** Index of column being dragged over (for visual feedback) */
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
  
  /** Index of row being dragged over (for visual feedback) */
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);

  // ============================================================================
  // CONTEXT MENU STATE
  // ============================================================================
  
  /** Context menu state for right-click operations */
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    type: 'column' | 'row';
    index: number;
  }>({ show: false, x: 0, y: 0, type: 'column', index: 0 });
  
  // ============================================================================
  // VIRTUAL SCROLLING STATE
  // ============================================================================
  
  /** Current scroll position in pixels (for virtual scrolling) */
  const [scrollTop, setScrollTop] = useState(0);
  
  /** Height of the scroll container in pixels */
  const [containerHeight, setContainerHeight] = useState(600);
  
  // ============================================================================
  // VIRTUAL SCROLLING CONSTANTS
  // ============================================================================
  
  /** Fixed height of each row in pixels */
  const ROW_HEIGHT = 40;
  
  /** Number of extra rows to render outside viewport for smooth scrolling */
  const BUFFER_SIZE = 10;
  
  // ============================================================================
  // REFS
  // ============================================================================
  
  /** Reference to the main table element */
  const tableRef = useRef<HTMLTableElement>(null);
  
  /** Reference to the main scrollable container for virtual scrolling */
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // EFFECTS AND UTILITY FUNCTIONS
  // ============================================================================
  
  /**
   * Debounce filter text input to prevent excessive re-renders with large datasets
   * Waits 150ms after user stops typing before applying the filter
   */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedFilterText(filterText);
    }, 150); // Reduced debounce time for better responsiveness

    return () => clearTimeout(timeoutId);
  }, [filterText]);

  /**
   * Handle scroll events for virtual scrolling
   * Updates scroll position to determine which rows are visible
   */
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  }, []);

  /**
   * Update container height on mount and when container is resized
   * Essential for virtual scrolling calculations
   */
  useEffect(() => {
    const updateContainerHeight = () => {
      if (scrollContainerRef.current) {
        const height = scrollContainerRef.current.clientHeight;
        setContainerHeight(height);
      }
    };

    updateContainerHeight();
    
    // Add resize listener to handle dynamic container size changes
    const resizeObserver = new ResizeObserver(updateContainerHeight);
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  /**
   * Optimized filtering with early exit and memoization
   * Filters data based on user input and determines if header should be shown
   * Uses early exit optimization for better performance with large datasets
   */
  const { filteredData, shouldShowHeaderRow } = useMemo(() => {
    // If no filter text, return all data
    if (!debouncedFilterText) {
      return {
        filteredData: gridData,
        shouldShowHeaderRow: true,
      };
    }

    const lowerFilterText = debouncedFilterText.toLowerCase().trim();
    
    // Check if any column headers match the filter
    const headerMatches = data.columns.some(col => 
      col.name.toLowerCase().includes(lowerFilterText)
    );

    // Optimized filtering with early exit - stops checking once a match is found
    const filtered = gridData.filter(row => {
      // Early exit optimization - check if any cell matches
      for (let i = 0; i < row.length; i++) {
        const cellValue = String(row[i].value).toLowerCase();
        if (cellValue.includes(lowerFilterText)) {
          return true;
        }
      }
      return false;
    });

    return {
      filteredData: filtered,
      shouldShowHeaderRow: headerMatches || filtered.length > 0,
    };
  }, [gridData, debouncedFilterText, data.columns]);

  /**
   * Virtual scrolling calculations with improved performance
   * Determines which rows are currently visible and calculates positioning
   * Only renders rows that are actually visible plus buffer rows for smooth scrolling
   */
  const { visibleRows, offsetY, startIndex, endIndex } = useMemo(() => {
    const totalRows = filteredData.length;
    
    // Calculate how many rows can fit in the viewport plus buffer
    const visibleRowCount = Math.min(totalRows, Math.ceil(containerHeight / ROW_HEIGHT) + BUFFER_SIZE * 2);
    
    // Calculate start and end indices for visible rows
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE);
    const endIndex = Math.min(totalRows, startIndex + visibleRowCount);
    
    return {
      visibleRows: filteredData.slice(startIndex, endIndex), // Only the rows we need to render
      totalHeight: totalRows * ROW_HEIGHT, // Total height for scrollbar
      offsetY: startIndex * ROW_HEIGHT, // Offset for spacer above visible rows
      startIndex,
      endIndex,
    };
  }, [filteredData, scrollTop, containerHeight]);

  /**
   * Memoized sorted data for better performance
   * Sorts the visible rows based on the selected column and direction
   * Handles both numeric and string sorting appropriately
   */
  const sortedData = useMemo(() => {
    // If no sorting is applied, return visible rows as-is
    if (sortColumn === null) {
      return visibleRows;
    }

    // Create a copy of visible rows and sort them
    return [...visibleRows].sort((a, b) => {
      const aVal = a[sortColumn].value;
      const bVal = b[sortColumn].value;
      
      // Handle numeric sorting
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      // Handle string sorting (case-insensitive)
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
  }, [visibleRows, sortColumn, sortDirection]);

  // ============================================================================
  // UNDO/REDO FUNCTIONS
  // ============================================================================
  
  /**
   * Save current state to history for undo/redo functionality
   * Creates a deep copy of current grid data and columns
   */
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      gridData: JSON.parse(JSON.stringify(gridData)), // Deep copy
      columns: JSON.parse(JSON.stringify(data.columns)) // Deep copy
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [gridData, data.columns, history, historyIndex]);

  /**
   * Undo the last action by restoring previous state
   * Handles both grid data and column name restoration
   */
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const previousState = history[historyIndex - 1];
      setGridData(JSON.parse(JSON.stringify(previousState.gridData)));
      
      // Restore column names via onHeaderChange callback
      if (onHeaderChange) {
        previousState.columns.forEach((col, index) => {
          if (col.name !== data.columns[index]?.name) {
            onHeaderChange(index, col.name);
          }
        });
      }
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, onHeaderChange, data.columns]);

  /**
   * Redo the last undone action by restoring next state
   * Handles both grid data and column name restoration
   */
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setGridData(JSON.parse(JSON.stringify(nextState.gridData)));
      
      // Restore column names via onHeaderChange callback
      if (onHeaderChange) {
        nextState.columns.forEach((col, index) => {
          if (col.name !== data.columns[index]?.name) {
            onHeaderChange(index, col.name);
          }
        });
      }
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, onHeaderChange, data.columns]);

  // ============================================================================
  // FORMULA EVALUATION FUNCTIONS
  // ============================================================================
  
  /**
   * Convert Excel-style column letter to zero-based index
   * Examples: A=0, B=1, Z=25, AA=26, AB=27, etc.
   * @param letter - The column letter(s) to convert
   * @returns Zero-based column index
   */
  const columnLetterToIndex = useCallback((letter: string): number => {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
      result = result * 26 + (letter.charCodeAt(i) - 65 + 1);
    }
    return result - 1;
  }, []);

  /**
   * Get the value of a cell by its Excel-style reference (e.g., "A1", "B2")
   * Handles both header row (row 1) and data rows
   * @param cellRef - Excel-style cell reference (e.g., "A1", "B2")
   * @returns The cell value (string or number)
   */
  const getCellValue = useCallback((cellRef: string): string | number => {
    const match = cellRef.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 0;
    
    const colLetter = match[1];
    const rowNum = parseInt(match[2], 10);
    
    // Convert to array indices
    const colIndex = columnLetterToIndex(colLetter);
    const rowIndex = rowNum - 2; // Account for header being row 1
    
    // Handle header row (row 1 in Excel = index 0 in our data)
    if (rowNum === 1) {
      return data.columns[colIndex]?.name || '';
    }
    
    // Handle data rows (row 2+ in Excel = index 0+ in our data)
    if (rowIndex >= 0 && rowIndex < gridData.length && colIndex >= 0 && colIndex < gridData[rowIndex].length) {
      return gridData[rowIndex][colIndex]?.value || 0;
    }
    
    return 0;
  }, [gridData, data.columns, columnLetterToIndex]);

  /**
   * Get all cell values in a range (e.g., "A1:B3", "A1")
   * Supports both single cell references and ranges
   * @param range - Excel-style range (e.g., "A1:B3", "A1")
   * @returns Array of cell values
   */
  const getCellsInRange = useCallback((range: string): (string | number)[] => {
    const values: (string | number)[] = [];
    
    // Handle single cell reference (no colon)
    if (!range.includes(':')) {
      values.push(getCellValue(range));
      return values;
    }
    
    // Handle range (e.g., "A1:B3")
    const [startCell, endCell] = range.split(':');
    if (!endCell) return values;
  
    // Parse start and end cell references
    const startMatch = startCell.match(/^([A-Z]+)(\d+)$/);
    const endMatch = endCell.match(/^([A-Z]+)(\d+)$/);
    
    if (!startMatch || !endMatch) return values;
    
    const startColIndex = columnLetterToIndex(startMatch[1]);
    const startRowNum = parseInt(startMatch[2], 10);
    const endColIndex = columnLetterToIndex(endMatch[1]);
    const endRowNum = parseInt(endMatch[2], 10);
    
    // Ensure proper ordering (handle ranges like "B3:A1")
    const minCol = Math.min(startColIndex, endColIndex);
    const maxCol = Math.max(startColIndex, endColIndex);
    const minRow = Math.min(startRowNum, endRowNum);
    const maxRow = Math.max(startRowNum, endRowNum);
    
    // Iterate through all cells in the range
    for (let rowNum = minRow; rowNum <= maxRow; rowNum++) {
      for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
        // Convert back to cell reference format
        const colLetter = String.fromCharCode(65 + colIndex);
        const cellRef = `${colLetter}${rowNum}`;
        values.push(getCellValue(cellRef));
      }
    }
  
    return values;
  }, [getCellValue, columnLetterToIndex]);
  
  /**
   * Evaluate Excel-like formulas
   * Supports: arithmetic expressions, SUM, AVERAGE, COUNT, MAX, MIN functions
   * @param formula - The formula to evaluate (e.g., "=SUM(A1:A10)", "=A1+B2")
   * @returns The calculated result or error string
   */
  const evaluateFormula = useCallback((formula: string): number | string => {
    const upperFormula = formula.toUpperCase().trim();
    
    try {
      // Handle basic arithmetic expressions (e.g., A1+B2, A1*B2/C3)
      if (!upperFormula.includes('(') && /^[A-Z0-9+\-*/.\s]+$/.test(upperFormula)) {
        // Replace cell references with their values
        let expression = upperFormula.replace(/([A-Z]+\d+)/g, (match) => {
          const value = getCellValue(match);
          return typeof value === 'number' ? value.toString() : '0';
        });
        
        // Evaluate the mathematical expression safely
        try {
          // Simple validation to prevent code injection
          if (!/^[0-9+\-*/.() ]+$/.test(expression)) {
            return '#ERROR!';
          }
          return eval(expression) || 0;
        } catch {
          return '#ERROR!';
        }
      }
      
      // SUM function - supports ranges and individual cells
      if (upperFormula.startsWith('SUM(')) {
        const args = upperFormula.slice(4, -1).split(',');
        let sum = 0;
        
        for (const arg of args) {
          const trimmedArg = arg.trim();
          const values = getCellsInRange(trimmedArg);
          sum += values.reduce((acc: number, val) => acc + (typeof val === 'number' ? val : 0), 0);
        }
        
        return sum;
      }
      
      // AVERAGE function
      if (upperFormula.startsWith('AVERAGE(')) {
        const args = upperFormula.slice(8, -1).split(',');
        let sum = 0;
        let count = 0;
        
        for (const arg of args) {
          const trimmedArg = arg.trim();
          const values = getCellsInRange(trimmedArg);
          const numericValues = values.filter(val => typeof val === 'number') as number[];
          sum += numericValues.reduce((acc, val) => acc + val, 0);
          count += numericValues.length;
        }
        
        return count > 0 ? sum / count : 0;
      }
      
      // COUNT function - counts non-empty cells
      if (upperFormula.startsWith('COUNT(')) {
        const args = upperFormula.slice(6, -1).split(',');
        let count = 0;
        
        for (const arg of args) {
          const trimmedArg = arg.trim();
          const values = getCellsInRange(trimmedArg);
          count += values.filter(val => typeof val === 'number').length;
        }
        
        return count;
      }
      
      // MAX function
      if (upperFormula.startsWith('MAX(')) {
        const args = upperFormula.slice(4, -1).split(',');
        let max = -Infinity;
        
        for (const arg of args) {
          const trimmedArg = arg.trim();
          const values = getCellsInRange(trimmedArg);
          const numericValues = values.filter(val => typeof val === 'number') as number[];
          if (numericValues.length > 0) {
            max = Math.max(max, ...numericValues);
          }
        }
        
        return max === -Infinity ? 0 : max;
      }
      
      // MIN function
      if (upperFormula.startsWith('MIN(')) {
        const args = upperFormula.slice(4, -1).split(',');
        let min = Infinity;
        
        for (const arg of args) {
          const trimmedArg = arg.trim();
          const values = getCellsInRange(trimmedArg);
          const numericValues = values.filter(val => typeof val === 'number') as number[];
          if (numericValues.length > 0) {
            min = Math.min(min, ...numericValues);
          }
        }
        
        return min === Infinity ? 0 : min;
      }
      
      // Single cell reference
      if (/^[A-Z]+\d+$/.test(upperFormula)) {
        return getCellValue(upperFormula);
      }
      
      return '#ERROR!';
    } catch (error) {
      return '#ERROR!';
    }
  }, [getCellsInRange, getCellValue]);

  // ============================================================================
  // CELL INTERACTION HANDLERS
  // ============================================================================
  
  /**
   * Handle cell click events with support for different selection modes
   * Supports: single select, multi-select (Ctrl/Cmd+click), range select (Shift+click)
   * @param row - Row index of clicked cell
   * @param col - Column index of clicked cell
   * @param e - Mouse event
   */
  const handleCellClick = (row: number, col: number, e: React.MouseEvent) => {
    // Prevent any default browser behavior
    e.preventDefault();
    
    const cellKey = `${row},${col}`;
    
    if (e.ctrlKey || e.metaKey) {
      // Multi-select mode (ctrl/cmd + click) - toggle cell selection
      const newSelectedCells = new Set(selectedCells);
      if (newSelectedCells.has(cellKey)) {
        newSelectedCells.delete(cellKey);
      } else {
        newSelectedCells.add(cellKey);
      }
      setSelectedCells(newSelectedCells);
      setSelectedCell({ row, col });
      setSelectedRange(null);
    } else if (e.shiftKey && selectedCell) {
      // Range selection mode (shift + click) - select from last cell to current
      const startRow = Math.min(selectedCell.row, row);
      const endRow = Math.max(selectedCell.row, row);
      const startCol = Math.min(selectedCell.col, col);
      const endCol = Math.max(selectedCell.col, col);
      
      const newSelectedCells = new Set<string>();
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          newSelectedCells.add(`${r},${c}`);
        }
      }
      
      setSelectedCells(newSelectedCells);
      setSelectedCell({ row, col });
      setSelectedRange({
        start: { row: startRow, col: startCol },
        end: { row: endRow, col: endCol }
      });
    } else {
      // Single select mode - clear previous selection
      setSelectedCell({ row, col });
      setSelectedCells(new Set([cellKey]));
      setSelectedRange(null);
    }
    setEditingCell(null);
  };

  /**
   * Handle mouse down on cells to initiate drag selection
   * Prevents text selection and handles drag start logic
   * @param row - Row index of cell
   * @param col - Column index of cell
   * @param e - Mouse event
   */
  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    // Prevent text selection during drag
    e.preventDefault();
    
    // Don't start dragging if shift or ctrl/cmd is pressed (these are for selection)
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      return;
    }
    
    setIsDragging(true);
    setDragStart({ row, col });
    setSelectedCell({ row, col });
    setSelectedCells(new Set([`${row},${col}`]));
    setSelectedRange(null);
  };

  /**
   * Handle mouse enter on cells during drag operations
   * Updates the selection range in real-time as user drags
   * @param row - Row index of cell being entered
   * @param col - Column index of cell being entered
   */
  const handleCellMouseEnter = (row: number, col: number) => {
    if (isDragging && dragStart) {
      const newRange = {
        start: dragStart,
        end: { row, col }
      };
      setSelectedRange(newRange);
      
      // Update selectedCells for real-time preview
      const minRow = Math.min(dragStart.row, row);
      const maxRow = Math.max(dragStart.row, row);
      const minCol = Math.min(dragStart.col, col);
      const maxCol = Math.max(dragStart.col, col);
      
      const newSelectedCells = new Set<string>();
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          newSelectedCells.add(`${r},${c}`);
        }
      }
      setSelectedCells(newSelectedCells);
    }
  };

  /**
   * Handle mouse up events to finalize drag operations
   * Converts range selection to individual cell selections
   */
  const handleMouseUp = () => {
    // Don't handle mouse up if we're currently resizing
    if (resizingColumn !== null || resizingRow !== null) {
      return;
    }
    
    if (isDragging && selectedRange) {
      // Convert range selection to individual cell selections
      const { start, end } = selectedRange;
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      
      const newSelectedCells = new Set<string>();
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          newSelectedCells.add(`${r},${c}`);
        }
      }
      setSelectedCells(newSelectedCells);
    }
    
    setIsDragging(false);
    setDragStart(null);
    setSelectedRange(null);
  };

  /**
   * Handle double-click on cells to enter edit mode
   * Works for both data cells and header cells
   * @param row - Row index of cell
   * @param col - Column index of cell
   */
  const handleDoubleClick = (row: number, col: number) => {
    // All cells (including header row) use regular editing logic
    setEditingCell({ row, col });
  };

  /**
   * Handle clicking on row number to select entire row
   * Selects all cells in the clicked row
   * @param row - Row index to select
   * @param e - Mouse event
   */
  const handleRowHeaderClick = (row: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Select all cells in this row
    const newSelectedCells = new Set<string>();
    for (let col = 0; col < data.columns.length; col++) {
      newSelectedCells.add(`${row},${col}`);
    }
    
    setSelectedCells(newSelectedCells);
    setSelectedCell({ row, col: 0 }); // Set primary selection to first cell in row
    setSelectedRange({
      start: { row, col: 0 },
      end: { row, col: data.columns.length - 1 }
    });
    setEditingCell(null);
  };

  /**
   * Handle clicking on column header to select entire column
   * Selects all cells in the clicked column (including header)
   * @param col - Column index to select
   * @param e - Mouse event
   */
  const handleColumnHeaderClick = (col: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't select if we're currently resizing or just finished resizing
    if (resizingColumn !== null || justFinishedResize) {
      return;
    }
    
    // Select all cells in this column (including header row)
    const newSelectedCells = new Set<string>();
    // Include header row (-1) and all data rows
    for (let row = -1; row < gridData.length; row++) {
      newSelectedCells.add(`${row},${col}`);
    }
    
    setSelectedCells(newSelectedCells);
    setSelectedCell({ row: -1, col }); // Set primary selection to header cell
    setSelectedRange({
      start: { row: -1, col },
      end: { row: gridData.length - 1, col }
    });
    setEditingCell(null);
  };

  /**
   * Handle right-click on column header to show context menu
   * Shows options to insert columns left/right
   * @param colIndex - Column index that was right-clicked
   * @param e - Mouse event
   */
  const handleColumnHeaderRightClick = (colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      type: 'column',
      index: colIndex
    });
  };

  /**
   * Handle right-click on row header to show context menu
   * Shows options to insert rows above/below
   * @param rowIndex - Row index that was right-clicked
   * @param e - Mouse event
   */
  const handleRowHeaderRightClick = (rowIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      type: 'row',
      index: rowIndex
    });
  };

  /**
   * Close the context menu
   */
  const closeContextMenu = () => {
    setContextMenu({ show: false, x: 0, y: 0, type: 'column', index: 0 });
  };

  // ============================================================================
  // DRAG AND DROP HANDLERS
  // ============================================================================
  
  /**
   * Handle column drag start for reordering
   * @param colIndex - Index of column being dragged
   * @param e - Drag event
   */
  const handleColumnDragStart = (colIndex: number, e: React.DragEvent) => {
    setDraggedColumn(colIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colIndex.toString());
  };

  /**
   * Handle column drag over for visual feedback
   * @param colIndex - Index of column being dragged over
   * @param e - Drag event
   */
  const handleColumnDragOver = (colIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(colIndex);
  };

  /**
   * Handle column drag leave to clear visual feedback
   * @param e - Drag event
   */
  const handleColumnDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
  };

  /**
   * Handle column drop to complete reordering
   * Reorders both the data and column widths
   * @param targetIndex - Index where column is being dropped
   * @param e - Drag event
   */
  const handleColumnDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const sourceIndex = draggedColumn;
    
    if (sourceIndex === null || sourceIndex === targetIndex) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    // Reorder columns in parent component
    if (onReorderColumns) {
      onReorderColumns(sourceIndex, targetIndex);
    }

    // Reorder grid data columns
    const newGridData = gridData.map(row => {
      const newRow = [...row];
      const [draggedCell] = newRow.splice(sourceIndex, 1);
      newRow.splice(targetIndex, 0, draggedCell);
      return newRow;
    });

    // Reorder column widths
    const newColumnWidths = [...columnWidths];
    const [draggedWidth] = newColumnWidths.splice(sourceIndex, 1);
    newColumnWidths.splice(targetIndex, 0, draggedWidth);

    setGridData(newGridData);
    setColumnWidths(newColumnWidths);
    setDraggedColumn(null);
    setDragOverColumn(null);
    saveToHistory();
  };

  const handleColumnDragEnd = (e: React.DragEvent) => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  /**
   * Handle row drag start for reordering
   * @param rowIndex - Index of row being dragged
   * @param e - Drag event
   */
  const handleRowDragStart = (rowIndex: number, e: React.DragEvent) => {
    setDraggedRow(rowIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', rowIndex.toString());
  };

  /**
   * Handle row drag over for visual feedback
   * @param rowIndex - Index of row being dragged over
   * @param e - Drag event
   */
  const handleRowDragOver = (rowIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverRow(rowIndex);
  };

  /**
   * Handle row drag leave to clear visual feedback
   * @param e - Drag event
   */
  const handleRowDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRow(null);
  };

  const handleRowDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const sourceIndex = draggedRow;
    
    if (sourceIndex === null || sourceIndex === targetIndex) {
      setDraggedRow(null);
      setDragOverRow(null);
      return;
    }

    // Don't allow reordering the header row (index -1) with data rows
    if ((sourceIndex === -1 && targetIndex !== -1) || (sourceIndex !== -1 && targetIndex === -1)) {
      setDraggedRow(null);
      setDragOverRow(null);
      return;
    }

    // Only reorder data rows (not header row)
    if (sourceIndex !== -1 && targetIndex !== -1) {
      // Reorder grid data rows
      const newGridData = [...gridData];
      const [draggedRowData] = newGridData.splice(sourceIndex, 1);
      newGridData.splice(targetIndex, 0, draggedRowData);

      // Reorder row heights
      const newRowHeights = [...rowHeights];
      const [draggedHeight] = newRowHeights.splice(sourceIndex, 1);
      newRowHeights.splice(targetIndex, 0, draggedHeight);

      setGridData(newGridData);
      setRowHeights(newRowHeights);
      saveToHistory();
    }

    setDraggedRow(null);
    setDragOverRow(null);
  };

  const handleRowDragEnd = (e: React.DragEvent) => {
    setDraggedRow(null);
    setDragOverRow(null);
  };

  // ============================================================================
  // INSERT OPERATIONS
  // ============================================================================
  
  /**
   * Insert a new column to the left of the specified index
   * @param colIndex - Index where to insert the new column
   */
  const insertColumnLeft = (colIndex: number) => {
    const newColumnLetter = String.fromCharCode(65 + colIndex);
    const newColumn = {
      name: '',
      key: `col_${newColumnLetter.toLowerCase()}_${Date.now()}`
    };

    if (onInsertColumn) {
      onInsertColumn(colIndex, newColumn);
    }

    // Insert empty cell data for the new column in all existing rows
    const updated = gridData.map(row => {
      const newRow = [...row];
      newRow.splice(colIndex, 0, { value: '', format: {} });
      return newRow;
    });
    setGridData(updated);

    // Update column widths array
    const newWidths = [...columnWidths];
    newWidths.splice(colIndex, 0, 150); // Default width
    setColumnWidths(newWidths);

    saveToHistory();
    closeContextMenu();
  };

  // Insert column to the right of the specified index
  const insertColumnRight = (colIndex: number) => {
    const insertIndex = colIndex + 1;
    const newColumnLetter = String.fromCharCode(65 + insertIndex);
    const newColumn = {
      name: '',
      key: `col_${newColumnLetter.toLowerCase()}_${Date.now()}`
    };

    if (onInsertColumn) {
      onInsertColumn(insertIndex, newColumn);
    }

    // Insert empty cell data for the new column in all existing rows
    const updated = gridData.map(row => {
      const newRow = [...row];
      newRow.splice(insertIndex, 0, { value: '', format: {} });
      return newRow;
    });
    setGridData(updated);

    // Update column widths array
    const newWidths = [...columnWidths];
    newWidths.splice(insertIndex, 0, 150); // Default width
    setColumnWidths(newWidths);

    saveToHistory();
    closeContextMenu();
  };

  // Insert row above the specified index
  const insertRowAbove = (rowIndex: number) => {
    // Create new empty row
    const newRow = Array(data.columns.length).fill(null).map(() => ({
      value: '',
      format: {}
    }));

    const updated = [...gridData];
    const insertIndex = rowIndex === -1 ? 0 : rowIndex; // If header row, insert at beginning of data
    updated.splice(insertIndex, 0, newRow);
    setGridData(updated);

    // Update row heights array
    const newHeights = [...rowHeights];
    newHeights.splice(insertIndex, 0, 40); // Default row height
    setRowHeights(newHeights);

    saveToHistory();
    closeContextMenu();
  };

  // Insert row below the specified index
  const insertRowBelow = (rowIndex: number) => {
    // Create new empty row
    const newRow = Array(data.columns.length).fill(null).map(() => ({
      value: '',
      format: {}
    }));

    const updated = [...gridData];
    const insertIndex = rowIndex === -1 ? 0 : rowIndex + 1; // If header row, insert at beginning of data
    updated.splice(insertIndex, 0, newRow);
    setGridData(updated);

    // Update row heights array
    const newHeights = [...rowHeights];
    newHeights.splice(insertIndex, 0, 40); // Default row height
    setRowHeights(newHeights);

    saveToHistory();
    closeContextMenu();
  };

  // ============================================================================
  // INPUT HANDLERS
  // ============================================================================
  
  /**
   * Handle input changes in cells (both data and header cells)
   * Supports formulas, numeric validation, and real-time updates
   * @param e - Input change event
   * @param row - Row index of the cell
   * @param col - Column index of the cell
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, row: number, col: number) => {
    const value = e.target.value;
    
    if (row === -1) {
      // Header row - update the column name via onHeaderChange
      if (onHeaderChange) {
        onHeaderChange(col, value);
      }
    } else {
      // Regular data cells
      // Check if this is a numeric column
      if (isNumericColumn(col)) {
        // For numeric columns, validate the input
        if (!isValidNumericInput(value)) {
          return; // Don't update if invalid
        }
      }
      
      const updated = [...gridData];
      
      if (value.startsWith('=')) {
        const result = evaluateFormula(value.slice(1));
        updated[row][col] = {
          ...updated[row][col],
          formula: value,
          value: result
        };
      } else {
        // For numeric columns, always convert to number if valid
        if (isNumericColumn(col)) {
          updated[row][col] = {
            ...updated[row][col],
            value: value === '' ? '' : Number(value),
            formula: undefined
          };
        } else {
          // For non-numeric columns, allow any value
          updated[row][col] = {
            ...updated[row][col],
            value: value,
            formula: undefined
          };
        }
      }
      
      setGridData(updated);
    }
  };

  const handleInputBlur = () => {
    setEditingCell(null);
    // Always save to history when editing ends (for both data cells and header cells)
    saveToHistory();
  };

  const handleHeaderDoubleClick = (colIndex: number) => {
    setEditingHeader(colIndex);
    setHeaderEditValue(data.columns[colIndex].name);
  };

  const handleHeaderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHeaderEditValue(e.target.value);
  };

  const handleHeaderInputBlur = () => {
    if (editingHeader !== null) {
      if (onHeaderChange) {
        onHeaderChange(editingHeader, headerEditValue);
      }
      setEditingHeader(null);
    }
  };

  const handleHeaderInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleHeaderInputBlur();
    } else if (e.key === 'Escape') {
      setEditingHeader(null);
    }
  };

  // ============================================================================
  // FORMATTING FUNCTIONS
  // ============================================================================
  
  /**
   * Apply formatting to a cell (bold, italic, alignment, background color)
   * @param row - Row index of the cell
   * @param col - Column index of the cell
   * @param format - Formatting options to apply
   */
  const formatCell = (row: number, col: number, format: Partial<CellFormat>) => {
    const updated = [...gridData];
    updated[row][col] = {
      ...updated[row][col],
      format: { ...updated[row][col].format, ...format }
    };
    setGridData(updated);
    saveToHistory();
  };

  const clearCell = (row: number, col: number) => {
    const updated = [...gridData];
    updated[row][col] = { value: '', format: updated[row][col].format };
    setGridData(updated);
    saveToHistory();
  };

  // Excel-like Ctrl+Arrow navigation - jump to data boundaries
  const jumpToDataBoundary = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!selectedCell) return;
    
    const { row, col } = selectedCell;
    let newRow = row;
    let newCol = col;
    
    switch (direction) {
      case 'up':
        if (row === -1) break; // Can't go up from header
        // Find the first empty cell or boundary going up
        for (let r = row - 1; r >= -1; r--) {
          if (r === -1 || !gridData[r] || !gridData[r][col] || gridData[r][col].value === '') {
            newRow = r === -1 ? -1 : r + 1;
            break;
          }
          if (r === 0) {
            newRow = -1; // Jump to header if we've reached the top
            break;
          }
        }
        break;
        
      case 'down':
        if (row === -1) {
          newRow = 0; // Jump to first data row
          break;
        }
        // Find the first empty cell or boundary going down
        for (let r = row + 1; r < gridData.length; r++) {
          if (!gridData[r] || !gridData[r][col] || gridData[r][col].value === '') {
            newRow = r - 1;
            break;
          }
          if (r === gridData.length - 1) {
            newRow = r; // Stay at last row if we've reached the bottom
            break;
          }
        }
        break;
        
      case 'left':
        // Find the first empty cell or boundary going left
        for (let c = col - 1; c >= 0; c--) {
          if (row === -1 || !gridData[row] || !gridData[row][c] || gridData[row][c].value === '') {
            newCol = c + 1;
            break;
          }
          if (c === 0) {
            newCol = 0; // Jump to first column
            break;
          }
        }
        break;
        
      case 'right':
        // Find the first empty cell or boundary going right
        for (let c = col + 1; c < data.columns.length; c++) {
          if (row === -1 || !gridData[row] || !gridData[row][c] || gridData[row][c].value === '') {
            newCol = c - 1;
            break;
          }
          if (c === data.columns.length - 1) {
            newCol = c; // Stay at last column
            break;
          }
        }
        break;
    }
    
    setSelectedCell({ row: newRow, col: newCol });
    setSelectedCells(new Set([`${newRow},${newCol}`]));
    setSelectedRange(null);
  }, [selectedCell, gridData, data.columns.length]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!selectedCell) return;
    
    // Don't handle keyboard events if user is typing in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    const { row, col } = selectedCell;
    
    // Handle keyboard shortcuts with Ctrl/Cmd
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z':
          e.preventDefault();
          undo();
          break;
        case 'y':
          e.preventDefault();
          redo();
          break;
        case 'b':
          e.preventDefault();
          if (row !== -1) {
            formatCell(row, col, { bold: !gridData[row][col].format?.bold });
          }
          break;
        case 'i':
          e.preventDefault();
          if (row !== -1) {
            formatCell(row, col, { italic: !gridData[row][col].format?.italic });
          }
          break;
        // Ctrl+Arrow keys for jumping to data boundaries
        case 'ArrowUp':
          e.preventDefault();
          jumpToDataBoundary('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          jumpToDataBoundary('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          jumpToDataBoundary('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          jumpToDataBoundary('right');
          break;
        case 'Home':
          e.preventDefault();
          setSelectedCell({ row: -1, col: 0 }); // Go to A1
          setSelectedCells(new Set(['-1,0']));
          setSelectedRange(null);
          break;
        case 'End':
          e.preventDefault();
          // Go to last cell with data
          const lastRow = gridData.length - 1;
          const lastCol = data.columns.length - 1;
          setSelectedCell({ row: lastRow, col: lastCol });
          setSelectedCells(new Set([`${lastRow},${lastCol}`]));
          setSelectedRange(null);
          break;
      }
      return;
    }

    // Don't handle navigation if currently editing
    if (editingCell) {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setEditingCell(null);
          break;
        case 'Enter':
          e.preventDefault();
          setEditingCell(null);
          // Move down after Enter in edit mode
          if (row < gridData.length - 1) {
            setSelectedCell({ row: row + 1, col });
            setSelectedCells(new Set([`${row + 1},${col}`]));
            setSelectedRange(null);
          }
          break;
        case 'Tab':
          e.preventDefault();
          setEditingCell(null);
          // Move right after Tab in edit mode
          if (e.shiftKey) {
            // Shift+Tab moves left
            if (col > 0) {
              setSelectedCell({ row, col: col - 1 });
              setSelectedCells(new Set([`${row},${col - 1}`]));
              setSelectedRange(null);
            }
          } else {
            // Tab moves right
            if (col < data.columns.length - 1) {
              setSelectedCell({ row, col: col + 1 });
              setSelectedCells(new Set([`${row},${col + 1}`]));
              setSelectedRange(null);
            }
          }
          break;
      }
      return;
    }

    // Navigation keys when not editing
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (row > -1) {
          setSelectedCell({ row: row - 1, col });
          setSelectedCells(new Set([`${row - 1},${col}`]));
          setSelectedRange(null);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (row === -1) {
          // From header row to first data row
          setSelectedCell({ row: 0, col });
          setSelectedCells(new Set([`0,${col}`]));
          setSelectedRange(null);
        } else if (row < gridData.length - 1) {
          setSelectedCell({ row: row + 1, col });
          setSelectedCells(new Set([`${row + 1},${col}`]));
          setSelectedRange(null);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) {
          setSelectedCell({ row, col: col - 1 });
          setSelectedCells(new Set([`${row},${col - 1}`]));
          setSelectedRange(null);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (col < data.columns.length - 1) {
          setSelectedCell({ row, col: col + 1 });
          setSelectedCells(new Set([`${row},${col + 1}`]));
          setSelectedRange(null);
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab moves left
          if (col > 0) {
            setSelectedCell({ row, col: col - 1 });
            setSelectedCells(new Set([`${row},${col - 1}`]));
            setSelectedRange(null);
          } else if (row > -1) {
            // Wrap to end of previous row
            const newRow = row - 1;
            const newCol = data.columns.length - 1;
            setSelectedCell({ row: newRow, col: newCol });
            setSelectedCells(new Set([`${newRow},${newCol}`]));
            setSelectedRange(null);
          }
        } else {
          // Tab moves right
          if (col < data.columns.length - 1) {
            setSelectedCell({ row, col: col + 1 });
            setSelectedCells(new Set([`${row},${col + 1}`]));
            setSelectedRange(null);
          } else if (row < gridData.length - 1) {
            // Wrap to beginning of next row
            const newRow = row + 1;
            setSelectedCell({ row: newRow, col: 0 });
            setSelectedCells(new Set([`${newRow},0`]));
            setSelectedRange(null);
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        setEditingCell({ row, col });
        break;
      case 'F2':
        e.preventDefault();
        setEditingCell({ row, col });
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (row !== -1) {
          clearCell(row, col);
        }
        break;
      case 'Home':
        e.preventDefault();
        setSelectedCell({ row, col: 0 }); // Go to beginning of current row
        setSelectedCells(new Set([`${row},0`]));
        setSelectedRange(null);
        break;
      case 'End':
        e.preventDefault();
        const endCol = data.columns.length - 1;
        setSelectedCell({ row, col: endCol }); // Go to end of current row
        setSelectedCells(new Set([`${row},${endCol}`]));
        setSelectedRange(null);
        break;
      case 'PageUp':
        e.preventDefault();
        const newRowUp = Math.max(-1, row - 10); // Move up 10 rows
        setSelectedCell({ row: newRowUp, col });
        setSelectedCells(new Set([`${newRowUp},${col}`]));
        setSelectedRange(null);
        break;
      case 'PageDown':
        e.preventDefault();
        const newRowDown = Math.min(gridData.length - 1, row + 10); // Move down 10 rows
        setSelectedCell({ row: newRowDown, col });
        setSelectedCells(new Set([`${newRowDown},${col}`]));
        setSelectedRange(null);
        break;
      case 'Escape':
        e.preventDefault();
        // Clear selection or deselect
        setSelectedCells(new Set());
        setSelectedRange(null);
        break;
      default:
        // Start editing if user types a printable character
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          
          // Check if this is a numeric column (inline to avoid dependency issues)
          const isNumeric = col > 0 && gridData.every(row => {
            const value = row[col]?.value;
            return value === '' || typeof value === 'number';
          });
          
          // For numeric columns, only allow valid numeric characters
          if (row !== -1 && isNumeric) {
            const allowedNumericChars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-'];
            if (!allowedNumericChars.includes(e.key)) {
              return; // Don't start editing if invalid character for numeric column
            }
          }
          
          setEditingCell({ row, col });
          // Clear the cell content when starting to type
          if (row !== -1) {
            const updated = [...gridData];
            
            // For numeric columns, convert to number if valid
            if (isNumeric) {
              const numValue = Number(e.key);
              updated[row][col] = { 
                value: isNaN(numValue) ? e.key : numValue, 
                format: updated[row][col].format 
              };
            } else {
              updated[row][col] = { value: e.key, format: updated[row][col].format };
            }
            
            setGridData(updated);
          }
        }
        break;
    }
  }, [selectedCell, editingCell, gridData, data.columns.length, undo, redo, clearCell, formatCell, jumpToDataBoundary]);

  // ============================================================================
  // SORTING AND RESIZING FUNCTIONS
  // ============================================================================
  
  /**
   * Handle column sorting (toggle between ascending, descending, and no sort)
   * @param colIndex - Index of column to sort
   */
  const handleSort = (colIndex: number) => {
    const newDirection = sortColumn === colIndex && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(colIndex);
    setSortDirection(newDirection);
    
    // Sort the entire dataset, not just visible rows
    const sorted = [...gridData].sort((a, b) => {
      const aVal = a[colIndex].value;
      const bVal = b[colIndex].value;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return newDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (newDirection === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });
    
    setGridData(sorted);
    saveToHistory();
  };

  const handleColumnResize = (colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(colIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[colIndex]);
  };

  const handleRowResize = (rowIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingRow(rowIndex);
    setResizeStartY(e.clientY);
    setResizeStartHeight(rowHeights[rowIndex]);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (resizingColumn !== null) {
      // Excel-like behavior: resize only on the right side
      const diff = e.clientX - resizeStartX;
      const newWidth = Math.max(50, resizeStartWidth + diff);
      const newWidths = [...columnWidths];
      newWidths[resizingColumn] = newWidth;
      setColumnWidths(newWidths);
    }
    if (resizingRow !== null) {
      const diff = e.clientY - resizeStartY;
      const newHeight = Math.max(20, resizeStartHeight + diff);
      const newHeights = [...rowHeights];
      newHeights[resizingRow] = newHeight;
      setRowHeights(newHeights);
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth, columnWidths, resizingRow, resizeStartY, resizeStartHeight, rowHeights]);

  const handleMouseUpResize = useCallback(() => {
    if (resizingColumn !== null) {
      setJustFinishedResize(true);
      setTimeout(() => setJustFinishedResize(false), 100);
    }
    setResizingColumn(null);
    setResizingRow(null);
  }, [resizingColumn]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUpResize);
    document.addEventListener('click', closeContextMenu);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUpResize);
      document.removeEventListener('click', closeContextMenu);
    };
  }, [handleKeyDown, handleMouseMove, handleMouseUpResize]);

  // Initialize history with initial state
  useEffect(() => {
    if (history.length === 0) {
      setHistory([{
        gridData: JSON.parse(JSON.stringify(gridData)),
        columns: JSON.parse(JSON.stringify(data.columns))
      }]);
      setHistoryIndex(0);
    }
  }, [gridData, data.columns, history.length]);

  // Calculate column widths to fill the container after mount
  useEffect(() => {
    if (tableRef.current && data.columns.length > 0) {
      const container = tableRef.current.closest('.overflow-x-auto');
      if (container) {
        const containerWidth = container.clientWidth;
        const rowNumberColumnWidth = 48; // Width of row numbers column
        const availableWidth = containerWidth - rowNumberColumnWidth;
        const columnCount = data.columns.length;
        
        if (availableWidth > 0 && columnCount > 0) {
          const baseWidth = Math.max(100, Math.floor(availableWidth / columnCount));
          setColumnWidths(Array(columnCount).fill(baseWidth));
        }
      }
    }
  }, [data.columns.length]);

  const isInRange = useCallback((row: number, col: number): boolean => {
    const cellKey = `${row},${col}`;
    
    // Check if cell is in individual selection
    if (selectedCells.has(cellKey)) return true;
    
    // Check if cell is in range selection (for drag preview)
    if (selectedRange) {
      const { start, end } = selectedRange;
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
    }
    
    return false;
  }, [selectedCells, selectedRange]);

  const getCellDisplayValue = useCallback((cell: CellData): string | number => {
    if (cell.formula) {
      return cell.value;
    }
    return cell.value;
  }, []);

  const getCellStyle = useCallback((cell: CellData) => {
    const format = cell.format || {};
    return {
      fontWeight: format.bold ? 'bold' : 'normal',
      fontStyle: format.italic ? 'italic' : 'normal',
      textAlign: format.alignment || 'left' as const,
      backgroundColor: format.backgroundColor || 'transparent'
    };
  }, []);

  // Convert column index to letter (A, B, C, ..., Z, AA, AB, etc.)
  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  /**
   * Convert column index to Excel-style letter (0=A, 1=B, 25=Z, 26=AA, etc.)
   * @param index - Zero-based column index
   * @returns Excel-style column letter(s)
   */
  const getColumnLetter = (index: number): string => {
    let result = '';
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result;
      index = Math.floor(index / 26) - 1;
    }
    return result;
  };

  // Convert array indices back to cell reference (e.g., 0,1 -> A2)
  const getCellReference = useCallback((row: number, col: number): string => {
    const colLetter = String.fromCharCode(65 + col);
    const rowNumber = row === -1 ? 1 : row + 2; // Header row is 1, data starts at 2
    return `${colLetter}${rowNumber}`;
  }, []);

  // Generate range string from selected cells
  const getSelectedRange = useCallback((): string | null => {
    if (selectedCells.size === 0) return null;
    
    // Convert cell keys to positions
    const positions = Array.from(selectedCells).map(key => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    });
    
    // Find bounds
    const minRow = Math.min(...positions.map(p => p.row));
    const maxRow = Math.max(...positions.map(p => p.row));
    const minCol = Math.min(...positions.map(p => p.col));
    const maxCol = Math.max(...positions.map(p => p.col));
    
    // If it's a single cell
    if (minRow === maxRow && minCol === maxCol) {
      return getCellReference(minRow, minCol);
    }
    
    // If it's a rectangular range
    const startRef = getCellReference(minRow, minCol);
    const endRef = getCellReference(maxRow, maxCol);
    return `${startRef}:${endRef}`;
  }, [selectedCells, getCellReference]);

  // Apply a function to selected cells
  const applyFunctionToSelection = useCallback((functionName: string) => {
    const range = getSelectedRange();
    if (!range) return;
    
    // Find a good place to put the result
    const positions = Array.from(selectedCells).map(key => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    });
    
    const minRow = Math.min(...positions.map(p => p.row));
    const maxRow = Math.max(...positions.map(p => p.row));
    const minCol = Math.min(...positions.map(p => p.col));
    const maxCol = Math.max(...positions.map(p => p.col));
    
    let targetRow: number;
    let targetCol: number;
    
    // Check if selection is primarily horizontal (row-based)
    const isHorizontalSelection = (maxCol - minCol) >= (maxRow - minRow);
    
    if (isHorizontalSelection) {
      // For horizontal selections, place result to the right
      targetRow = minRow; // Use the first row of the selection
      targetCol = maxCol + 1; // Place one column to the right
    } else {
      // For vertical selections, place result below
      targetRow = maxRow + 1;
      targetCol = minCol;
    }
    
    // Ensure target row is valid (create new row if needed)
    let updated = [...gridData];
    
    // If target row is beyond current data, add a new row
    if (targetRow >= gridData.length) {
      const newRow = Array(data.columns.length).fill(null).map(() => ({
        value: '',
        format: {}
      }));
      updated.push(newRow);
    }
    
    // If target column is beyond current columns, add new columns
    if (targetCol >= data.columns.length) {
      const columnsToAdd = targetCol - data.columns.length + 1;
      
      // Create new column definitions
      const newColumns = [];
      for (let i = data.columns.length; i < data.columns.length + columnsToAdd; i++) {
        const newColumnLetter = String.fromCharCode(65 + i);
        newColumns.push({
          name: '',
          key: `col_${newColumnLetter.toLowerCase()}`
        });
      }
      
      // Add columns via parent callback
      if (onAddColumns) {
        onAddColumns(newColumns);
      }
      
      // Extend all existing rows to include new columns
      updated = updated.map(row => {
        const newCells = Array(columnsToAdd).fill(null).map(() => ({
          value: '',
          format: {}
        }));
        return [...row, ...newCells];
      });
      
      // Update column widths array to include the new columns
      const newWidths = Array(columnsToAdd).fill(150);
      setColumnWidths([...columnWidths, ...newWidths]);
    }
    
    // Calculate the effective column count after potential expansion
    const effectiveColumnCount = targetCol >= data.columns.length ? targetCol + 1 : data.columns.length;
    
    // Ensure target is within bounds after potential expansion
    if (targetRow >= 0 && targetRow < updated.length && 
        targetCol >= 0 && targetCol < effectiveColumnCount) {
      
      const formula = `=${functionName}(${range})`;
      const result = evaluateFormula(formula.slice(1));
      
      updated[targetRow][targetCol] = {
        value: result,
        formula: formula,
        format: updated[targetRow][targetCol]?.format || {}
      };
      
      setGridData(updated);
      
      // Update row heights array if we added a new row
      if (targetRow >= rowHeights.length) {
        setRowHeights([...rowHeights, 40]); // Default row height
      }
      
      saveToHistory();
      
      // Select the cell with the new formula
      setSelectedCell({ row: targetRow, col: targetCol });
      setSelectedCells(new Set([`${targetRow},${targetCol}`]));
    }
  }, [selectedCells, gridData, data.columns.length, getSelectedRange, getCellReference, evaluateFormula, saveToHistory, rowHeights, columnWidths, onHeaderChange, onAddColumns, onInsertColumn]);

  /**
   * Check if a column should only accept numbers
   * Determines this by checking if all non-empty values in the column are numeric
   * @param colIndex - Index of column to check
   * @returns True if column should be numeric-only
   */
  const isNumericColumn = (colIndex: number): boolean => {
    // Skip the first column (product names) - now at index 0 after row numbers
    if (colIndex === 0) return false;
    
    // Check if all non-empty values in this column are numbers
    return gridData.every(row => {
      const value = row[colIndex]?.value;
      return value === '' || typeof value === 'number';
    });
  };

  /**
   * Validate numeric input for real-time validation
   * Allows empty string, negative signs, and decimal points during typing
   * @param value - Input value to validate
   * @returns True if input is valid numeric input
   */
  const isValidNumericInput = (value: string): boolean => {
    // Allow empty string, numbers, decimal points, and negative signs
    if (value === '' || value === '-') return true;
    
    // Check if it's a valid number (including decimals and negative numbers)
    const numRegex = /^-?\d*\.?\d*$/;
    return numRegex.test(value);
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  return (
    <div className={clsx(
      "w-full h-screen flex flex-col bg-white overflow-hidden",
      (resizingColumn !== null || resizingRow !== null) && "cursor-grabbing",
      isDragging && "select-none"
    )}>
      {/* Content Header */}
      <div className="bg-white px-4 sm:px-6 py-3 sm:py-4 border-b-2 border-gray-400 flex-shrink-0">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 mb-1 sm:mb-2">
          Product Portfolio Revenue Analysis (2020-2023)
        </h1>
        <p className="text-blue-600 text-xs sm:text-sm">
          Interactive financial data visualization with comprehensive editing capabilities
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white px-4 sm:px-6 py-2 sm:py-3 border-b-2 border-gray-400 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={undo}
                disabled={historyIndex <= 0}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none"
              >
                Undo
              </button>
              <button
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium shadow-sm transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none"
              >
                Redo
              </button>
            </div>
            
            {(selectedCell || selectedCells.size > 0) && (
              <div className="flex items-center gap-2">
                {/* Function Buttons */}
                {selectedCells.size > 0 && (
                  <div className="flex items-center gap-2 mr-3 border-r border-gray-300 pr-3">
                    <div className="text-xs font-medium text-gray-600 mr-1">Functions:</div>
                    <button
                      onClick={() => applyFunctionToSelection('SUM')}
                      className="inline-flex items-center px-3 py-1.5 bg-white border border-blue-200 hover:border-blue-300 hover:bg-blue-50 text-blue-700 rounded-md text-sm font-medium transition-all duration-200 shadow-sm hover:shadow"
                      title="Apply SUM function to selected range"
                    >
                      <span className="text-base mr-1">∑</span>
                      <span>Sum</span>
                    </button>
                    <button
                      onClick={() => applyFunctionToSelection('AVERAGE')}
                      className="inline-flex items-center px-3 py-1.5 bg-white border border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 text-emerald-700 rounded-md text-sm font-medium transition-all duration-200 shadow-sm hover:shadow"
                      title="Apply AVERAGE function to selected range"
                    >
                      <span className="text-sm mr-1">⌀</span>
                      <span>Avg</span>
                    </button>
                  </div>
                )}
                
                {/* Formatting Buttons */}
                <button
                  onClick={() => {
                    // Apply to all selected cells (skip header row)
                    selectedCells.forEach(cellKey => {
                      const [row, col] = cellKey.split(',').map(Number);
                      if (row !== -1 && gridData[row]?.[col]) {
                        const currentBold = gridData[row][col].format?.bold;
                        formatCell(row, col, { bold: !currentBold });
                      }
                    });
                  }}
                  className={clsx(
                    'px-3 py-1 rounded border text-sm',
                    (selectedCell && selectedCell.row !== -1 && gridData[selectedCell.row]?.[selectedCell.col]?.format?.bold) ? 'bg-slate-600 text-white' : 'bg-white border-gray-400'
                  )}
                >
                  B
                </button>
                <button
                  onClick={() => {
                    // Apply to all selected cells (skip header row)
                    selectedCells.forEach(cellKey => {
                      const [row, col] = cellKey.split(',').map(Number);
                      if (row !== -1 && gridData[row]?.[col]) {
                        const currentItalic = gridData[row][col].format?.italic;
                        formatCell(row, col, { italic: !currentItalic });
                      }
                    });
                  }}
                  className={clsx(
                    'px-3 py-1 rounded border italic text-sm',
                    (selectedCell && selectedCell.row !== -1 && gridData[selectedCell.row]?.[selectedCell.col]?.format?.italic) ? 'bg-slate-600 text-white' : 'bg-white border-gray-400'
                  )}
                >
                  I
                </button>
                <div className="flex border border-gray-400 rounded overflow-hidden">
                  <button
                    onClick={() => {
                      selectedCells.forEach(cellKey => {
                        const [row, col] = cellKey.split(',').map(Number);
                        if (row !== -1 && gridData[row]?.[col]) {
                          formatCell(row, col, { alignment: 'left' });
                        }
                      });
                    }}
                    className={clsx(
                      'px-2 py-1 text-sm border-r border-gray-400 hover:bg-gray-100',
                      (selectedCell && selectedCell.row !== -1 && gridData[selectedCell.row]?.[selectedCell.col]?.format?.alignment === 'left') ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700'
                    )}
                    title="Align Left"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 3h18v2H3V3zm0 8h14v2H3v-2zm0 8h18v2H3v-2z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      selectedCells.forEach(cellKey => {
                        const [row, col] = cellKey.split(',').map(Number);
                        if (row !== -1 && gridData[row]?.[col]) {
                          formatCell(row, col, { alignment: 'center' });
                        }
                      });
                    }}
                    className={clsx(
                      'px-2 py-1 text-sm border-r border-gray-400 hover:bg-gray-100',
                      (selectedCell && selectedCell.row !== -1 && gridData[selectedCell.row]?.[selectedCell.col]?.format?.alignment === 'center') ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700'
                    )}
                    title="Align Center"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 3h18v2H3V3zm2 8h14v2H5v-2zm-2 8h18v2H3v-2z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      selectedCells.forEach(cellKey => {
                        const [row, col] = cellKey.split(',').map(Number);
                        if (row !== -1 && gridData[row]?.[col]) {
                          formatCell(row, col, { alignment: 'right' });
                        }
                      });
                    }}
                    className={clsx(
                      'px-2 py-1 text-sm hover:bg-gray-100',
                      (selectedCell && selectedCell.row !== -1 && gridData[selectedCell.row]?.[selectedCell.col]?.format?.alignment === 'right') ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700'
                    )}
                    title="Align Right"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 3h18v2H3V3zm4 8h14v2H7v-2zm-4 8h18v2H3v-2z"/>
                    </svg>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="color"
                    value={selectedCell && selectedCell.row !== -1 ? (gridData[selectedCell.row]?.[selectedCell.col]?.format?.backgroundColor || '#ffffff') : '#ffffff'}
                    onChange={(e) => {
                      selectedCells.forEach(cellKey => {
                        const [row, col] = cellKey.split(',').map(Number);
                        if (row !== -1 && gridData[row]?.[col]) {
                          formatCell(row, col, { backgroundColor: e.target.value });
                        }
                      });
                    }}
                    className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                  />
                  <div className="w-8 h-8 border border-gray-400 rounded flex items-center justify-center bg-white">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24"
                      className="text-gray-600"
                    >
                      <path d="M21.143 9.667c-.733-1.392-1.914-3.05-3.617-4.753-2.977-2.978-5.478-3.914-6.785-3.914-.414 0-.708.094-.86.246l-1.361 1.36c-1.899-.236-3.42.106-4.294.983-.876.875-1.164 2.159-.792 3.523.492 1.806 2.305 4.049 5.905 5.375.038.323.157.638.405.885.588.588 1.535.586 2.121 0s.588-1.533.002-2.119c-.588-.587-1.537-.588-2.123-.001l-.17.256c-2.031-.765-3.395-1.828-4.232-2.9l3.879-3.875c.496 2.73 6.432 8.676 9.178 9.178l-7.115 7.107c-.234.153-2.798-.316-6.156-3.675-3.393-3.393-3.175-5.271-3.027-5.498l1.859-1.856c-.439-.359-.925-1.103-1.141-1.689l-2.134 2.131c-.445.446-.685 1.064-.685 1.82 0 1.634 1.121 3.915 3.713 6.506 2.764 2.764 5.58 4.243 7.432 4.243.648 0 1.18-.195 1.547-.562l8.086-8.078c.91.874-.778 3.538-.778 4.648 0 1.104.896 1.999 2 1.999 1.105 0 2-.896 2-2 0-3.184-1.425-6.81-2.857-9.34zm-16.209-5.371c.527-.53 1.471-.791 2.656-.761l-3.209 3.206c-.236-.978-.049-1.845.553-2.445zm9.292 4.079l-.03-.029c-1.292-1.292-3.803-4.356-3.096-5.063.715-.715 3.488 1.521 5.062 3.096.862.862 2.088 2.247 2.937 3.458-1.717-1.074-3.491-1.469-4.873-1.462z"/>
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {selectedCells.size > 1 && (
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-sm font-medium">
                {selectedCells.size} cells selected
              </div>
            )}
            <div className="relative group">
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-md text-sm font-medium cursor-help">
                📊 Formulas
              </div>
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-xs text-gray-700 hidden group-hover:block z-50 w-64">
                <div className="font-medium mb-2">Available Functions:</div>
                <div className="space-y-1">
                  <div><code>=SUM(A2:A5)</code> - Sum of range</div>
                  <div><code>=AVERAGE(B2:B5)</code> - Average of range</div>
                  <div><code>=A2+B2</code> - Basic arithmetic</div>
                  <div><code>=A2*B2/C2</code> - Complex expressions</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Filter..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="px-3 py-1 border border-gray-400 rounded text-sm"
              />
              
              {/* Performance indicator */}
              <div className="text-xs text-gray-600">
                <span className="font-medium">Performance:</span> 
                Showing {sortedData.length} of {filteredData.length} rows 
                {filteredData.length !== gridData.length && ` (filtered from ${gridData.length})`}
                {startIndex > 0 && ` • Virtual scrolling active`}
              </div>
            </div>
          </div>
        </div>
      </div>
        
      {/* Data Table */}
      <div className="flex-1 bg-white mx-2 sm:mx-4 lg:mx-8 my-2 sm:my-4 lg:my-6 rounded-lg shadow-lg border-2 border-gray-400">
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-auto max-h-[80vh]"
          onScroll={handleScroll}
        >
          <table 
            ref={tableRef} 
            className="border-collapse border-2 border-gray-400 select-none"
            style={{ 
              minWidth: Math.max(800, columnWidths.reduce((sum, width) => sum + width, 0) + 50),
              userSelect: 'none'
            }}
          >
            {/* Column Letters Header */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-100">
                {/* Empty corner cell */}
                <th className="w-12 h-8 border-b-2 border-r-2 border-gray-400 bg-slate-200 sticky left-0 z-40" style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)' }}></th>
                {/* Column letters */}
                {data.columns.map((col, colIndex) => (
                  <th
                    key={col.key}
                    draggable
                    className={clsx(
                      "px-2 py-1 text-center font-medium text-slate-700 relative group cursor-pointer hover:bg-slate-200",
                      resizingColumn === colIndex && 'border-r-blue-500',
                      draggedColumn === colIndex && 'opacity-50',
                      dragOverColumn === colIndex && 'border-l-4 border-l-blue-500'
                    )}
                    style={{ 
                      width: columnWidths[colIndex],
                      borderBottom: '2px solid #9ca3af',
                      borderRight: '2px solid #9ca3af',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    onClick={(e) => handleColumnHeaderClick(colIndex, e)}
                    onContextMenu={(e) => handleColumnHeaderRightClick(colIndex, e)}
                    onDragStart={(e) => handleColumnDragStart(colIndex, e)}
                    onDragOver={(e) => handleColumnDragOver(colIndex, e)}
                    onDragLeave={handleColumnDragLeave}
                    onDrop={(e) => handleColumnDrop(colIndex, e)}
                    onDragEnd={handleColumnDragEnd}
                  >
                    {getColumnLetter(colIndex)}
                    <button
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors z-20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSort(colIndex);
                      }}
                      title="Sort column"
                    >
                      {sortColumn === colIndex ? (
                        sortDirection === 'asc' ? '↑' : '↓'
                      ) : (
                        '↕'
                      )}
                    </button>
                    <div
                      className="absolute right-0 top-0 w-1 h-full cursor-col-resize bg-gray-300 hover:bg-blue-500 hover:w-2 transition-all duration-150 z-10 group-hover:bg-blue-400"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleColumnResize(colIndex, e);
                      }}
                      onDragStart={(e) => e.preventDefault()}
                      title="Drag to resize column width"
                    >
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-2 bg-gray-500 opacity-60"></div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            
            <tbody>
              {/* Header row (row 1) - scrolls with data */}
              {shouldShowHeaderRow && (
              <tr className="hover:bg-slate-50 bg-white">
                <td 
                  draggable
                  className={clsx(
                    "w-12 border-b-2 border-gray-400 bg-slate-200 text-center font-medium text-slate-700 relative group sticky left-0 z-10 cursor-pointer hover:bg-slate-300",
                    draggedRow === -1 && 'opacity-50',
                    dragOverRow === -1 && 'border-t-4 border-t-blue-500'
                  )}
                  style={{ 
                    borderRight: '2px solid #9ca3af',
                    boxShadow: '2px 0 4px rgba(0,0,0,0.1)'
                  }}
                  onClick={(e) => handleRowHeaderClick(-1, e)}
                  onContextMenu={(e) => handleRowHeaderRightClick(-1, e)}
                  onDragStart={(e) => handleRowDragStart(-1, e)}
                  onDragOver={(e) => handleRowDragOver(-1, e)}
                  onDragLeave={handleRowDragLeave}
                  onDrop={(e) => handleRowDrop(-1, e)}
                  onDragEnd={handleRowDragEnd}
                >
                  1
                  <div
                    className="absolute bottom-0 left-0 w-full h-0.5 cursor-row-resize bg-gray-300 hover:bg-blue-500 hover:h-1 transition-all duration-150"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleRowResize(-1, e);
                    }}
                    onDragStart={(e) => e.preventDefault()}
                    title="Drag to resize row height"
                  >
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-0.5 bg-gray-500 opacity-60"></div>
                  </div>
                </td>
                {data.columns.map((col, colIndex) => {
                  const cellKey = `-1,${colIndex}`;
                  const isSelected = selectedCell?.row === -1 && selectedCell?.col === colIndex;
                  const isEditing = editingCell?.row === -1 && editingCell?.col === colIndex;
                  const isInSelectionRange = isInRange(-1, colIndex);
                  const isIndividuallySelected = selectedCells.has(cellKey);

                  return (
                    <td
                      key={colIndex}
                      className={clsx(
                        'px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-center border-b-2 border-r-2 border-gray-400 cursor-pointer relative font-medium text-slate-700',
                        (isSelected || isIndividuallySelected) && 'bg-blue-100',
                        isInSelectionRange && !isSelected && !isIndividuallySelected && 'bg-blue-50',
                        isEditing && 'bg-white',
                        resizingColumn === colIndex && 'border-r-blue-500'
                      )}
                      onClick={(e) => handleCellClick(-1, colIndex, e)}
                      onMouseDown={(e) => handleCellMouseDown(-1, colIndex, e)}
                      onMouseEnter={() => handleCellMouseEnter(-1, colIndex)}
                      onDoubleClick={() => handleDoubleClick(-1, colIndex)}
                    >
                      {/* Selection border for header cells */}
                      {(isSelected || isIndividuallySelected) && (
                        <div className="absolute inset-0 border-2 border-blue-600 pointer-events-none z-10 bg-blue-100 bg-opacity-30" />
                      )}
                      {isInSelectionRange && !isSelected && !isIndividuallySelected && (
                        <div className="absolute inset-0 border border-blue-400 pointer-events-none z-5 bg-blue-50 bg-opacity-40" />
                      )}
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          className="w-full border-none outline-none bg-transparent text-center font-medium text-slate-700"
                          value={col.name}
                          onChange={(e) => handleInputChange(e, -1, colIndex)}
                          onBlur={handleInputBlur}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              handleInputBlur();
                            }
                          }}
                        />
                      ) : (
                        <span className="text-slate-700 font-medium">
                          {col.name}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
              )}
              
              {/* Virtual scrolling spacer for rows above viewport */}
              {startIndex > 0 && (
                <tr style={{ height: offsetY }}>
                  <td colSpan={data.columns.length + 1}></td>
                </tr>
              )}
              
              {/* Data rows - only render visible rows */}
              {sortedData.map((row, visibleRowIndex) => {
                const actualRowIndex = startIndex + visibleRowIndex;
                return (
                  <tr key={`${actualRowIndex}-${visibleRowIndex}`} className={clsx(
                    'hover:bg-slate-50',
                    actualRowIndex % 2 === 1 ? 'bg-white' : 'bg-slate-25'
                  )} style={{ height: rowHeights[actualRowIndex] || ROW_HEIGHT }}>
                    {/* Row number cell - start from row 2 since header is row 1 */}
                    <td 
                      draggable
                      className={clsx(
                        "w-12 border-b-2 border-gray-400 bg-slate-200 text-center font-medium text-slate-700 relative group sticky left-0 z-10 cursor-pointer hover:bg-slate-300",
                        draggedRow === actualRowIndex && 'opacity-50',
                        dragOverRow === actualRowIndex && 'border-t-4 border-t-blue-500'
                      )}
                      style={{ 
                        borderRight: '2px solid #9ca3af',
                        boxShadow: '2px 0 4px rgba(0,0,0,0.1)'
                      }}
                      onClick={(e) => handleRowHeaderClick(actualRowIndex, e)}
                      onContextMenu={(e) => handleRowHeaderRightClick(actualRowIndex, e)}
                      onDragStart={(e) => handleRowDragStart(actualRowIndex, e)}
                      onDragOver={(e) => handleRowDragOver(actualRowIndex, e)}
                      onDragLeave={handleRowDragLeave}
                      onDrop={(e) => handleRowDrop(actualRowIndex, e)}
                      onDragEnd={handleRowDragEnd}
                    >
                      {actualRowIndex + 2}
                      <div
                        className="absolute bottom-0 left-0 w-full h-0.5 cursor-row-resize bg-gray-300 hover:bg-blue-500 hover:h-1 transition-all duration-150"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleRowResize(actualRowIndex, e);
                        }}
                        onDragStart={(e) => e.preventDefault()}
                        title="Drag to resize row height"
                      >
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-0.5 bg-gray-500 opacity-60"></div>
                      </div>
                    </td>
                    {row.map((cell, colIndex) => {
                      const cellKey = `${actualRowIndex},${colIndex}`;
                      const isSelected = selectedCell?.row === actualRowIndex && selectedCell?.col === colIndex;
                      const isEditing = editingCell?.row === actualRowIndex && editingCell?.col === colIndex;
                      const isInSelectionRange = isInRange(actualRowIndex, colIndex);
                      const isIndividuallySelected = selectedCells.has(cellKey);

                      return (
                        <td
                          key={colIndex}
                          className={clsx(
                            'px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 text-center border-b-2 border-r-2 border-gray-400 cursor-pointer relative',
                            (isSelected || isIndividuallySelected) && 'bg-blue-100',
                            isInSelectionRange && !isSelected && !isIndividuallySelected && 'bg-blue-50',
                            isEditing && 'bg-white',
                            resizingRow === actualRowIndex && 'bg-gray-100',
                            resizingColumn === colIndex && 'border-r-blue-500'
                          )}
                          style={getCellStyle(cell)}
                          onClick={(e) => handleCellClick(actualRowIndex, colIndex, e)}
                          onMouseDown={(e) => handleCellMouseDown(actualRowIndex, colIndex, e)}
                          onMouseEnter={() => handleCellMouseEnter(actualRowIndex, colIndex)}
                          onDoubleClick={() => handleDoubleClick(actualRowIndex, colIndex)}
                        >
                          {/* Enhanced selection styling */}
                          {(isSelected || isIndividuallySelected) && (
                            <div className="absolute inset-0 border-2 border-blue-600 pointer-events-none z-10">
                              {/* Primary selection gets a thicker border and corner indicator */}
                              {isSelected && (
                                <>
                                  <div className="absolute inset-0 bg-blue-100 bg-opacity-40" />
                                  <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-blue-600 border border-white" />
                                </>
                              )}
                              {/* Multi-selected cells get subtle styling */}
                              {isIndividuallySelected && !isSelected && (
                                <div className="absolute inset-0 bg-blue-100 bg-opacity-30" />
                              )}
                            </div>
                          )}
                          {/* Range selection styling */}
                          {isInSelectionRange && !isSelected && !isIndividuallySelected && (
                            <div className="absolute inset-0 border border-blue-400 pointer-events-none z-5 bg-blue-50 bg-opacity-40" />
                          )}
                          {isEditing ? (
                            <input
                              autoFocus
                              type={isNumericColumn(colIndex) ? "number" : "text"}
                              step="any"
                              className={clsx(
                                "w-full border-none outline-none bg-transparent text-center",
                                isNumericColumn(colIndex) && "text-right"
                              )}
                              value={cell.formula || cell.value}
                              onChange={(e) => handleInputChange(e, actualRowIndex, colIndex)}
                              onBlur={handleInputBlur}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === 'Tab') {
                                  handleInputBlur();
                                }
                                // For numeric columns, allow only number-related keys
                                if (isNumericColumn(colIndex)) {
                                  const allowedKeys = [
                                    'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
                                    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                                    'Home', 'End', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
                                    '.', '-', 'e', 'E' // Allow decimal, negative, and scientific notation
                                  ];
                                  if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                                    e.preventDefault();
                                  }
                                }
                              }}
                              placeholder={isNumericColumn(colIndex) ? "Enter number..." : "Enter text..."}
                            />
                          ) : (
                            <span className="text-slate-700">
                              {getCellDisplayValue(cell)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              
              {/* Virtual scrolling spacer for rows below viewport */}
              {endIndex < filteredData.length && (
                <tr style={{ height: (filteredData.length - endIndex) * ROW_HEIGHT }}>
                  <td colSpan={data.columns.length + 1}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.show && (
        <div
          className="fixed bg-white border border-gray-300 rounded-lg shadow-lg py-1 z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'column' ? (
            <>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => insertColumnLeft(contextMenu.index)}
              >
                <span>⬅️</span>
                Insert Column Left
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => insertColumnRight(contextMenu.index)}
              >
                <span>➡️</span>
                Insert Column Right
              </button>
            </>
          ) : (
            <>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => insertRowAbove(contextMenu.index)}
              >
                <span>⬆️</span>
                Insert Row Above
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                onClick={() => insertRowBelow(contextMenu.index)}
              >
                <span>⬇️</span>
                Insert Row Below
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Spreadsheet;
