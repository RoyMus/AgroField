import { CellFormat, CellStyle } from '@/types/cellTypes';

// Convert RGB to hex
export const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// Convert Google Sheets API format to our CellFormat
export const convertGoogleSheetsFormat = (googleFormat: any): CellFormat => {
  const format: CellFormat = {};

  if (googleFormat.backgroundColor) {
    const { red = 1, green = 1, blue = 1 } = googleFormat.backgroundColor;
    format.backgroundColor = rgbToHex(
      Math.round(red * 255),
      Math.round(green * 255),
      Math.round(blue * 255)
    );
  }

  if (googleFormat.textFormat) {
    const textFormat = googleFormat.textFormat;
    
    if (textFormat.foregroundColor) {
      const { red = 0, green = 0, blue = 0 } = textFormat.foregroundColor;
      format.textColor = rgbToHex(
        Math.round(red * 255),
        Math.round(green * 255),
        Math.round(blue * 255)
      );
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
        const color = border.color ? rgbToHex(
          Math.round((border.color.red || 0) * 255),
          Math.round((border.color.green || 0) * 255),
          Math.round((border.color.blue || 0) * 255)
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

// Convert our CellFormat to Google Sheets API format
export const convertToGoogleSheetsFormat = (format: CellFormat): any => {
  const googleFormat: any = {};

  if (format.backgroundColor) {
    const hex = format.backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    googleFormat.backgroundColor = { red: r, green: g, blue: b };
  }

  if (format.textColor || format.fontWeight || format.fontStyle || format.fontSize) {
    googleFormat.textFormat = {};
    
    if (format.textColor) {
      const hex = format.textColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      googleFormat.textFormat.foregroundColor = { red: r, green: g, blue: b };
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
        const hex = border.color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16) / 255;
        const g = parseInt(hex.substr(2, 2), 16) / 255;
        const b = parseInt(hex.substr(4, 2), 16) / 255;
        
        googleFormat.borders[side] = {
          style: border.style.toUpperCase(),
          color: { red: r, green: g, blue: b },
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