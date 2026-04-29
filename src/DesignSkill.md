Standardize the UI and charts across the entire application and fix all inconsistencies.

UI Fixes:
- Ensure consistent font sizes for headers, subheaders, and body text across all screens
- Standardize colors (text, buttons, backgrounds, cards)
- Fix inconsistent table styles:
  - Same header style (font size, weight, background)
  - Same row height, padding, and borders
- Normalize card layout (padding, border radius, shadow)
- Ensure consistent spacing, margins, and alignment across all pages

Charts Standardization:
- Ensure all donut charts and bar charts have consistent size and layout:
  - Donut charts: medium size, centered, properly spaced
  - Bar charts: uniform height and width across all dashboards
- Fix charts that appear too small or too large inside containers
- Ensure all charts are properly aligned within cards

Chart Data:
- Replace any dummy/static data with real data from the data source
- Ensure charts display correct values on initial load (without requiring filters)
- Handle empty/null data gracefully

Chart Animations:
- Donut charts:
  - Smooth draw animation on load
  - Hover effect (slight expand/highlight)
- Bar charts:
  - Animate bars growing from bottom on load
  - Smooth transition when data updates
- Progress bars:
  - Animate sliding from right to left
  - Use consistent animation duration (300–600ms)
- Keep animations smooth, subtle, and professional

General Rules:
- Do NOT change existing functionality or data logic
- Do NOT redesign layouts, only fix consistency and behavior
- Maintain responsiveness across all screen sizes
- Avoid inline styles, use consistent Tailwind classes or shared components

Optional Improvements:
- Create reusable components for:
  - Charts (ChartContainer)
  - Tables
  - Cards
- Centralize styles for consistency

Goal:
A clean, consistent, professional UI across all dashboards (Business, Program, Project, Team) with uniform charts and smooth animations.