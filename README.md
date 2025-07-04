# Frontend Take-Home Assessment: Interactive Spreadsheet Component

## Overview

Thank you for your interest in our Frontend Engineer position. This assessment is designed to evaluate your frontend development skills, particularly your ability to build interactive user interfaces and work with complex data structures.

## Task Description

Your task is to create a spreadsheet-like component that mimics the core functionality of Microsoft Excel or Google Sheets. This component should allow users to view, edit, and manipulate tabular data in an intuitive way.

![Spreadsheet Example](image_(9).png)

## Core Requirements

- **Data Display**: Render tabular data in a grid format with column headers and row indices.
- **Cell Selection**: Allow users to select individual cells by clicking on them.
- **Range Selection**: Support selecting a range of cells by clicking and dragging.
- **In-cell Editing**: Enable users to edit cell content directly within the grid.
- **Cell Formatting**: Implement basic text formatting options (bold, italic, alignment, etc.).
- **Data Persistence**: Changes to cell data should persist during the session.

## Bonus Features

- **Cell Highlighting**: Allow users to highlight cells with different background colors.
- **Formula Support**: Implement basic formula functionality (e.g., `SUM`, `AVERAGE`).
- **Keyboard Navigation**: Support keyboard shortcuts for navigation and editing.
- **Column Resizing**: Allow users to resize column widths.
- **Sorting & Filtering**: Enable sorting and filtering data based on column values.
- **Undo/Redo**: Implement undo and redo functionality for user actions.

## Technical Requirements

- **Frontend Framework**: Use React, Vue, or Angular (**React preferred**).
- **State Management**: Demonstrate proper state management techniques.
- **Performance**: Ensure the component performs well with large datasets (1000+ rows).
- **Responsive Design**: The component should be usable on different screen sizes.
- **Code Quality**: Write clean, well-organized, and documented code.
- **Testing**: Include unit tests for core functionality.

## API Integration

Your component should fetch initial data from an API endpoint. Use the following sample API response format to develop your component, repeating the `"Values"` object for additional metrics like YoY Growth and Percent of Total:

```json
{
  "Values": {
    "columns": [
      { "name": "product", "key": "product" },
      { "name": "2020", "key": "2020" },
      { "name": "2021", "key": "2021" },
      { "name": "2022", "key": "2022" },
      { "name": "2023", "key": "2023" }
    ],
    "items": [
      {
        "product": "Insight Advisory",
        "2020": 5118724.63,
        "2021": 2630672.13,
        "2022": 4900641.34,
        "2023": 3051708.32
      },
      {
        "product": "OperateX Staffing",
        "2020": 10053102.32,
        "2021": 20638163.62,
        "2022": 20133558.99,
        "2023": 20576136.45
      },
      ...
    ]
  }
}
```
> 💡 **For development purposes**, you can either mock this API or create a simple backend that returns this data structure.

---

## Submission Guidelines

- Submit your code as a **GitHub repository**
- Share your submission with: **[lalit@keye.co](mailto:lalit@keye.co)**
- Your repository must include:
  - ✅ **Setup and running instructions**
  - ✅ **A brief explanation of your implementation approach**
  - ✅ **Any assumptions or design decisions you made**
  - ✅ **Description of what you would improve with more time**
- Deploy a **live demo** of your application (e.g., Vercel, Netlify, GitHub Pages)
- **Expected completion time**: 4–6 hours

---

## Evaluation Criteria

- **Functionality**: Does the component work as expected and meet requirements?
- **Code Quality**: Is the code well-structured, readable, and maintainable?
- **UI/UX**: Is the interface intuitive and user-friendly?
- **Performance**: Does the component handle large datasets efficiently?
- **Technical Choices**: Are the technical decisions appropriate for the problem?
- **Documentation**: Is the code and submission well-documented?

---

## Questions?

If you have any questions or need clarification about the requirements, please reach out to us at **[lalit@keye.co](mailto:lalit@keye.co)**.

##