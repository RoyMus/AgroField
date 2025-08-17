import { CellFormat, CellStyle } from '@/types/cellTypes';

// Convert RGB normalized values (0-1) to hex
export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (val: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, val))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Convert Google Sheets normalized RGB (0-1) to hex
export const normalizedRgbToHex = (red: number, green: number, blue: number): string => {
  return rgbToHex(red * 255, green * 255, blue * 255);
};

// Convert Google Sheets API format to our CellFormat
export const convertGoogleSheetsFormat = (googleFormat: any): CellFormat => {
  const format: CellFormat = {};

  // Handle background color - only convert if it exists and isn't default white
  if (googleFormat.backgroundColor) {
    const { red, green, blue } = googleFormat.backgroundColor;
    // Only add background color if it's explicitly set and not default white
    if (red !== undefined || green !== undefined || blue !== undefined) {
      const r = red ?? 1;
      const g = green ?? 1; 
      const b = blue ?? 1;
      // Don't add white backgrounds as they're default
      if (!(r >= 0.99 && g >= 0.99 && b >= 0.99)) {
        format.backgroundColor = normalizedRgbToHex(r, g, b);
      }
    }
  }

  if (googleFormat.textFormat) {
    const textFormat = googleFormat.textFormat;
    
    // Handle text color - only convert if it exists and isn't default black
    if (textFormat.foregroundColor) {
      const { red, green, blue } = textFormat.foregroundColor;
      if (red !== undefined || green !== undefined || blue !== undefined) {
        const r = red ?? 0;
        const g = green ?? 0;
        const b = blue ?? 0;
        // Don't add black text as it's default
        if (!(r <= 0.01 && g <= 0.01 && b <= 0.01)) {
          format.textColor = normalizedRgbToHex(r, g, b);
        }
      }
    }

    if (textFormat.bold) {
      format.fontWeight = 'bold';
    }

    if (textFormat.italic) {
      format.fontStyle = 'italic';
    }

    if (textFormat.fontSize) {
      format.fontSize = textFormat.fontSize;
    }
  }

  if (googleFormat.horizontalAlignment) {
    const alignment = googleFormat.horizontalAlignment.toLowerCase();
    if (['left', 'center', 'right'].includes(alignment)) {
      format.textAlign = alignment as 'left' | 'center' | 'right';
    }
  }

  if (googleFormat.borders) {
    format.borders = {};
    ['top', 'bottom', 'left', 'right'].forEach(side => {
      const border = googleFormat.borders[side];
      if (border && border.style !== 'NONE') {
        const color = border.color ? normalizedRgbToHex(
          border.color.red || 0,
          border.color.green || 0,
          border.color.blue || 0
        ) : '#000000';
        
        format.borders![side as keyof typeof format.borders] = {
          style: border.style.toLowerCase(),
          color,
          width: border.width || 1
        };
      }
    });
  }

  return format;
};

// Convert hex to Google Sheets normalized RGB (0-1)
export const hexToNormalizedRgb = (hex: string): { red: number; green: number; blue: number } => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return { red: r, green: g, blue: b };
};

// Convert our CellFormat to Google Sheets API format
export const convertToGoogleSheetsFormat = (format: CellFormat): any => {
  const googleFormat: any = {};

  if (format.backgroundColor) {
    googleFormat.backgroundColor = hexToNormalizedRgb(format.backgroundColor);
  }

  if (format.textColor || format.fontWeight || format.fontStyle || format.fontSize) {
    googleFormat.textFormat = {};
    
    if (format.textColor) {
      googleFormat.textFormat.foregroundColor = hexToNormalizedRgb(format.textColor);
    }

    if (format.fontWeight === 'bold') {
      googleFormat.textFormat.bold = true;
    }

    if (format.fontStyle === 'italic') {
      googleFormat.textFormat.italic = true;
    }

    if (format.fontSize) {
      googleFormat.textFormat.fontSize = format.fontSize;
    }
  }

  if (format.textAlign) {
    googleFormat.horizontalAlignment = format.textAlign.toUpperCase();
  }

  if (format.borders) {
    googleFormat.borders = {};
    Object.entries(format.borders).forEach(([side, border]) => {
      if (border) {
        googleFormat.borders[side] = {
          style: border.style.toUpperCase(),
          color: hexToNormalizedRgb(border.color),
          width: border.width
        };
      }
    });
  }

  return googleFormat;
};

// Extract styles from Google Sheets API response
export const extractStylesFromSheetData = (sheetApiData: any): CellStyle[] => {
  const styles: CellStyle[] = [];
  
  if (sheetApiData?.sheets?.[0]?.data?.[0]?.rowData) {
    sheetApiData.sheets[0].data[0].rowData.forEach((row: any, rowIndex: number) => {
      if (row.values) {
        row.values.forEach((cell: any, colIndex: number) => {
          if (cell.userEnteredFormat || cell.effectiveFormat) {
            const format = convertGoogleSheetsFormat(
              cell.userEnteredFormat || cell.effectiveFormat
            );
            
            // Only add if there's actual formatting
            if (Object.keys(format).length > 0) {
              styles.push({
                rowIndex,
                columnIndex: colIndex,
                format
              });
            }
          }
        });
      }
    });
  }
  
  return styles;
};

// Apply CSS styles from CellFormat
export const applyCellFormatToStyle = (format: CellFormat): React.CSSProperties => {
  const style: React.CSSProperties = {};

  if (format.backgroundColor) {
    style.backgroundColor = format.backgroundColor;
  }

  if (format.textColor) {
    style.color = format.textColor;
  }

  if (format.fontWeight) {
    style.fontWeight = format.fontWeight;
  }

  if (format.fontStyle) {
    style.fontStyle = format.fontStyle;
  }

  if (format.textAlign) {
    style.textAlign = format.textAlign;
  }

  if (format.fontSize) {
    style.fontSize = `${format.fontSize}px`;
  }

  if (format.borders) {
    if (format.borders.top) {
      style.borderTop = `${format.borders.top.width}px ${format.borders.top.style} ${format.borders.top.color}`;
    }
    if (format.borders.bottom) {
      style.borderBottom = `${format.borders.bottom.width}px ${format.borders.bottom.style} ${format.borders.bottom.color}`;
    }
    if (format.borders.left) {
      style.borderLeft = `${format.borders.left.width}px ${format.borders.left.style} ${format.borders.left.color}`;
    }
    if (format.borders.right) {
      style.borderRight = `${format.borders.right.width}px ${format.borders.right.style} ${format.borders.right.color}`;
    }
  }

  return style;
};