import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { accessToken, fileName, sheetData, originalFileId } = await req.json()

    if (!accessToken || !fileName || !sheetData) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a new spreadsheet
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: fileName
        },
        sheets: [{
          properties: {
            title: sheetData.sheetName || 'Sheet1'
          }
        }]
      })
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.text()
      console.error('Failed to create spreadsheet:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to create spreadsheet', details: errorData }),
        { status: createResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newSpreadsheet = await createResponse.json()
    const newSpreadsheetId = newSpreadsheet.spreadsheetId
    const newSheetId = newSpreadsheet.sheets[0].properties.sheetId

    // Get the source sheet formatting first
    let sourceFormatting = null;
    if (originalFileId) {
      try {
        const sourceResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${originalFileId}?includeGridData=true`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            }
          }
        );

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
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}/values/${encodeURIComponent(sheetData.sheetName || 'Sheet1')}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: sheetData.values
        })
      }
    )

    if (!updateResponse.ok) {
      const errorData = await updateResponse.text()
      console.error('Failed to update sheet data:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to update sheet data', details: errorData }),
        { status: updateResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Copy formatting if we have source formatting
    if (sourceFormatting && sourceFormatting.rowData) {
      try {
        const requests = [];
        
        // Copy row formatting
        sourceFormatting.rowData.forEach((row, rowIndex) => {
          if (row.values) {
            row.values.forEach((cell, colIndex) => {
              if (cell.userEnteredFormat || cell.effectiveFormat) {
                const format = cell.userEnteredFormat || cell.effectiveFormat;
                
                requests.push({
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

        // Copy column widths
        if (sourceFormatting.columnMetadata) {
          sourceFormatting.columnMetadata.forEach((column, index) => {
            if (column.pixelSize) {
                requests.push({
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
        if (sourceFormatting.rowMetadata) {
          sourceFormatting.rowMetadata.forEach((row, index) => {
            if (row.pixelSize) {
                requests.push({
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

        // Apply formatting if we have requests
        if (requests.length > 0) {
          const formatResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${newSpreadsheetId}:batchUpdate`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                requests: requests
              })
            }
          );

          if (formatResponse.ok) {
            console.log('Successfully copied formatting');
          } else {
            const formatError = await formatResponse.text();
            console.error('Failed to copy formatting:', formatError);
          }
        }
      } catch (formatError) {
        console.error('Error copying formatting:', formatError);
        // Continue even if formatting fails
      }
    }

    // If originalFileId is provided, copy permissions from the original file
    if (originalFileId) {
      try {
        // Get permissions from original file
        const permissionsResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${originalFileId}/permissions`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            }
          }
        )

        if (permissionsResponse.ok) {
          const permissions = await permissionsResponse.json()
          
          // Copy each permission to the new file (skip owner permission)
          for (const permission of permissions.permissions || []) {
            if (permission.role !== 'owner') {
              await fetch(
                `https://www.googleapis.com/drive/v3/files/${newSpreadsheetId}/permissions`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    role: permission.role,
                    type: permission.type,
                    ...(permission.emailAddress && { emailAddress: permission.emailAddress }),
                    ...(permission.domain && { domain: permission.domain })
                  })
                }
              )
            }
          }
        }
      } catch (permissionError) {
        console.error('Failed to copy permissions:', permissionError)
        // Continue even if permission copying fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        spreadsheetId: newSpreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}/edit`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating Google Sheet:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})