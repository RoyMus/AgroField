import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { accessToken, fileName, sheetData, originalFileId } = await req.json();
    if (!accessToken || !fileName || !sheetData) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create a new spreadsheet
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: fileName
        },
        sheets: [
          {
            properties: {
              title: sheetData.sheetName || 'Sheet1'
            }
          }
        ]
      })
    });
    if (!createResponse.ok) {
      const errorData = await createResponse.text();
      console.error('Failed to create spreadsheet:', errorData);
      return new Response(JSON.stringify({
        error: 'Failed to create spreadsheet',
        details: errorData
      }), {
        status: createResponse.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const newSpreadsheet = await createResponse.json();
    const newSpreadsheetId = newSpreadsheet.spreadsheetId;
    const newSheetId = newSpreadsheet.sheets[0].properties.sheetId;
    let sourceFormatting = null;
    if (originalFileId) {
      try {
        const sourceResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${originalFileId}?includeGridData=true`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (sourceResponse.ok) {
          const sourceData = await sourceResponse.json();
          sourceFormatting = sourceData.sheets?.[0]?.data?.[0];
          console.log('Retrieved source formatting');
        }
      } catch (error) {
        console.error('Failed to get source formatting:', error);
      }
    }
    // Update the sheet with the data
    const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}/values/${encodeURIComponent(sheetData.sheetName || 'Sheet1')}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: sheetData.values
      })
    });
    if (!updateResponse.ok) {
      const errorData = await updateResponse.text();
      console.error('Failed to update sheet data:', errorData);
      return new Response(JSON.stringify({
        error: 'Failed to update sheet data',
        details: errorData
      }), {
        status: updateResponse.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Copy formatting - prioritize updated styles from our editor
    const formatRequests = [];
    // Helper function to convert hex color to RGB for Google Sheets
    const hexToRgb = (hex)=>{
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
      if (!result) return null;
      return {
        red: parseInt(result[1], 16) / 255,
        green: parseInt(result[2], 16) / 255,
        blue: parseInt(result[3], 16) / 255,
        alpha: result[4] ? parseInt(result[4], 16) / 255 : 1
      };
    };
    console.log(sheetData.formatting);
    // Apply formatting from our editor if available
    if (sheetData.formatting && Array.isArray(sheetData.formatting)) {
      sheetData.formatting.forEach((style)=>{
        const { rowIndex, columnIndex, format } = style;
        const googleFormat = {};
        if (format.backgroundColor) {
          const rgb = hexToRgb(format.backgroundColor);
          if (rgb) googleFormat.backgroundColor = rgb;
        }
        if (format.textColor || format.fontWeight || format.fontStyle || format.fontSize) {
          googleFormat.textFormat = {};
          if (format.textColor) {
            const rgb = hexToRgb(format.textColor);
            if (rgb) googleFormat.textFormat.foregroundColor = rgb;
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
          Object.entries(format.borders).forEach(([side, border])=>{
            if (border) {
              const rgb = hexToRgb(border.color);
              if (rgb) {
                googleFormat.borders[side] = {
                  style: border.style.toUpperCase(),
                  color: rgb,
                  width: border.width
                };
              }
            }
          });
        }
        if (Object.keys(googleFormat).length > 0) {
          formatRequests.push({
            repeatCell: {
              range: {
                sheetId: newSheetId,
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: columnIndex,
                endColumnIndex: columnIndex + 1
              },
              cell: {
                userEnteredFormat: googleFormat
              },
              fields: 'userEnteredFormat'
            }
          });
        }
      });
    } else if (sourceFormatting && sourceFormatting.rowData) {
      sourceFormatting.rowData.forEach((row, rowIndex)=>{
        if (row.values) {
          row.values.forEach((cell, colIndex)=>{
            if (cell.userEnteredFormat || cell.effectiveFormat) {
              const format = cell.userEnteredFormat || cell.effectiveFormat;
              formatRequests.push({
                repeatCell: {
                  range: {
                    sheetId: newSheetId,
                    startRowIndex: rowIndex,
                    endRowIndex: rowIndex + 1,
                    startColumnIndex: colIndex,
                    endColumnIndex: colIndex + 1
                  },
                  cell: {
                    userEnteredFormat: format
                  },
                  fields: 'userEnteredFormat'
                }
              });
            }
          });
        }
      });
    }
    // Copy column widths
    if (sourceFormatting?.columnMetadata) {
      sourceFormatting.columnMetadata.forEach((column, index)=>{
        if (column.pixelSize) {
          formatRequests.push({
            updateDimensionProperties: {
              range: {
                sheetId: newSheetId,
                dimension: 'COLUMNS',
                startIndex: index,
                endIndex: index + 1
              },
              properties: {
                pixelSize: column.pixelSize
              },
              fields: 'pixelSize'
            }
          });
        }
      });
    }
    // Copy row heights
    if (sourceFormatting?.rowMetadata) {
      sourceFormatting.rowMetadata.forEach((row, index)=>{
        if (row.pixelSize) {
          formatRequests.push({
            updateDimensionProperties: {
              range: {
                sheetId: newSheetId,
                dimension: 'ROWS',
                startIndex: index,
                endIndex: index + 1
              },
              properties: {
                pixelSize: row.pixelSize
              },
              fields: 'pixelSize'
            }
          });
        }
      });
    }
    // Apply all formatting requests
    if (formatRequests.length > 0) {
      try {
        const formatResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: formatRequests
          })
        });
        if (formatResponse.ok) {
          console.log('Successfully applied formatting with updated styles');
        } else {
          const formatError = await formatResponse.text();
          console.error('Failed to apply formatting:', formatError);
        }
      } catch (formatError) {
        console.error('Error applying formatting:', formatError);
      }
    }
    // If originalFileId is provided, copy permissions from the original file
    if (originalFileId) {
      try {
        // Get permissions from original file
        const permissionsResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${originalFileId}/permissions`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (permissionsResponse.ok) {
          const permissions = await permissionsResponse.json();
          // Copy each permission to the new file (skip owner permission)
          for (const permission of permissions.permissions || []){
            if (permission.role !== 'owner') {
              await fetch(`https://www.googleapis.com/drive/v3/files/${newSpreadsheetId}/permissions`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  role: permission.role,
                  type: permission.type,
                  ...permission.emailAddress && {
                    emailAddress: permission.emailAddress
                  },
                  ...permission.domain && {
                    domain: permission.domain
                  }
                })
              });
            }
          }
        }
      } catch (permissionError) {
        console.error('Failed to copy permissions:', permissionError);
      // Continue even if permission copying fails
      }
    }
    return new Response(JSON.stringify({
      success: true,
      spreadsheetId: newSpreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error creating Google Sheet:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
