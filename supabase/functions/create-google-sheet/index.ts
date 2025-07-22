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