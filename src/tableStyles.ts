/**
 * Consistent table styling standards across the application
 */

export const TABLE_STYLES = {
  // Table and row styling - new card-based design
  table: 'w-full border-collapse bg-transparent',
  headerRow: 'bg-transparent',
  // Header color: rgba(225, 227, 236, 1) background, rgba(118, 131, 150, 1) text, sharp corners
  headerCell: 'px-2.5 py-3 text-[12.81px] font-bold border-0' +
              ' bg-[#E1E3EC]' +
              ' text-[#768396]',
  dataRow: 'bg-white rounded-[11.9px] hover:shadow-md transition-shadow',
  dataRowGap: 'h-2',

  // Cell styling
  dataCell: 'px-2.5 py-3 text-[11px] text-gray-700 border-0 align-middle',
  dataCellMuted: 'px-2.5 py-3 text-[11px] text-gray-600 border-0',
  dataCellEmphasis: 'px-2.5 py-3 text-[11px] font-medium text-gray-900 border-0',
  dataCellLink: 'px-2.5 py-3 text-[11px] font-medium text-blue-600 border-0',

  // Row styling (legacy)
  row: 'bg-white rounded-[11.9px] hover:shadow-md transition-shadow',

  // Button styling
  actionButton: 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-amber-400 hover:text-amber-600 transition-colors',

  // Font sizes
  fontSize: 'text-[11px]',
  fontSizeSmall: 'text-[10px]',
  fontSizeLarge: 'text-[12px]',

  // Colors
  textNormal: 'text-gray-700',
  textMuted: 'text-gray-600',
  textEmphasis: 'text-gray-900',
  textLight: 'text-gray-500',
} as const;
