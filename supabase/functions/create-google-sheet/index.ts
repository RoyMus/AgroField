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
    const { accessToken, fileName, sheets, originalFileId } = await req.json();
    if (!accessToken || !fileName || !sheets) {
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
        // Step 1: Get parent folder(s) of the original file (if provided)
    let parentIds: string[] = [];
    if (originalFileId) {
      const fileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${originalFileId}?fields=parents`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (fileResponse.ok) {
        const fileData = await fileResponse.json();
        parentIds = fileData.parents || [];
      }
    }
    // Create a new spreadsheet with multiple sheets
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
        sheets: sheets.map((sheet: any, index: number) => ({
          properties: {
            title: sheet.sheetName || `Sheet${index + 1}`,
            sheetId: index,
            index: index
          }
        }))
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
      // Move file
    const moveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${newSpreadsheetId}?addParents=${parentIds.join(",")}&fields=id,parents`,
      {
        method: "PATCH",
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
      }
    );
    if (!moveRes.ok) {
      const errorData = await moveRes.text();
      console.error('Failed to move spreadsheet:', errorData);
    }
    const sheetIds = newSpreadsheet.sheets.map((s: any) => s.properties.sheetId);

    // Update each sheet with its data
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const sheetName = sheet.sheetName || `Sheet${i + 1}`;
      
      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}/values/${encodeURIComponent(sheetName)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: sheet.values,
          }),
        }
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.text();
        console.error(`Error updating sheet ${sheetName}:`, errorData);
        throw new Error(`Failed to update sheet data: ${updateResponse.statusText}`);
      }

      console.log(`Updated sheet ${sheetName} with data`);
    }

    // Helper function to convert hex color to RGB for Google Sheets
    const hexToRgb = (hex: string)=>{
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
      if (!result) return null;
      return {
        red: parseInt(result[1], 16) / 255,
        green: parseInt(result[2], 16) / 255,
        blue: parseInt(result[3], 16) / 255,
        alpha: result[4] ? parseInt(result[4], 16) / 255 : 1
      };
    };
    
    // Copy formatting for each sheet
    const formatRequests: any[] = [];
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const sheetId = sheetIds[i];
      
      // Apply formatting from our editor if available
      if (sheet.formatting && Array.isArray(sheet.formatting)) {
        // Get actual sheet dimensions to validate formatting bounds
        const sheetRowCount = sheet.values.length;
        const sheetColCount = Math.max(...sheet.values.map((row: any[]) => row.length));
        
        console.log(`Sheet ${sheet.sheetName} dimensions: ${sheetRowCount} rows x ${sheetColCount} cols`);
        
        sheet.formatting.forEach((style: any)=>{
          const { rowIndex, columnIndex, format } = style;
          
          // Validate that the cell is within sheet bounds
          if (rowIndex >= sheetRowCount || columnIndex >= sheetColCount) {
            console.warn(`Skipping style for cell (${rowIndex}, ${columnIndex}) - exceeds sheet bounds (${sheetRowCount}, ${sheetColCount})`);
            return;
          }
          
          const googleFormat: any = {};
          
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
            Object.entries(format.borders).forEach(([side, border]: [string, any])=>{
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
                  sheetId: sheetId,
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
      }
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
          console.log('Successfully applied formatting to all sheets');
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
  } catch (error: any) {
    console.error('Error creating Google Sheet:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
