
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Read the request body once and store it
    const requestBody = await req.json()
    const { action, code, accessToken, fileId } = requestBody
    
    console.log('Request action:', action)
    
    const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID')
    const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET')
    
    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Google Drive credentials not configured')
    }

    if (action === 'getAuthUrl') {
      const redirectUri = `${req.headers.get('origin')}/`
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets')}&` +
        `access_type=offline&` +
        `prompt=consent`

      console.log('Generated auth URL for redirect URI:', redirectUri)

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'exchangeCode') {
      const redirectUri = `${req.headers.get('origin')}/`
      
      console.log('Exchanging code for access token with redirect URI:', redirectUri)
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      })

      const tokenData = await tokenResponse.json()
      
      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData)
        throw new Error(`Token exchange failed: ${tokenData.error}`)
      }

      console.log('Token exchange successful')
      return new Response(JSON.stringify(tokenData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'listFiles') {
      console.log('Listing Google Drive files')
      
      const filesResponse = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.spreadsheet"&fields=files(id,name,modifiedTime)',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      const filesData = await filesResponse.json()
      
      if (!filesResponse.ok) {
        console.error('Failed to fetch files:', filesData)
        throw new Error(`Failed to fetch files: ${filesData.error}`)
      }

      console.log('Successfully fetched', filesData.files?.length || 0, 'files')
      return new Response(JSON.stringify(filesData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'readSheet') {
      console.log('Reading Google Sheet data for file:', fileId)
      
      // First, get sheet metadata to find available sheets
      const metadataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      if (!metadataResponse.ok) {
        const errorData = await metadataResponse.json()
        console.error('Failed to fetch sheet metadata:', errorData)
        throw new Error(`Failed to fetch sheet metadata: ${errorData.error?.message}`)
      }

      const metadata = await metadataResponse.json()
      const firstSheet = metadata.sheets[0]
      const sheetName = firstSheet.properties.title

      console.log('Reading data from sheet:', sheetName)

      // Get the data from the first sheet
      const dataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(sheetName)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      if (!dataResponse.ok) {
        const errorData = await dataResponse.json()
        console.error('Failed to fetch sheet data:', errorData)
        throw new Error(`Failed to fetch sheet data: ${errorData.error?.message}`)
      }

      const sheetData = await dataResponse.json()
      
      // Get formatting data with grid data
      const formattingResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?includeGridData=true`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      let formattingData = null;
      if (formattingResponse.ok) {
        try {
          const formatData = await formattingResponse.json();
          const sourceFormatting = formatData.sheets?.[0]?.data?.[0];
          
          // Extract cell formatting
          const cellStyles: Array<any> = [];
          if (sourceFormatting?.rowData) {
            sourceFormatting.rowData.forEach((row: any, rowIndex: number) => {
              if (row.values) {
                row.values.forEach((cell: any, colIndex: number) => {
                  if (cell.userEnteredFormat || cell.effectiveFormat) {
                    const format = cell.userEnteredFormat || cell.effectiveFormat;
                    
                    // Convert Google Sheets format to our format
                    const convertedFormat: any = {};
                    
                    if (format.backgroundColor) {
                      const { red = 1, green = 1, blue = 1 } = format.backgroundColor;
                      convertedFormat.backgroundColor = `#${Math.round(red * 255).toString(16).padStart(2, '0')}${Math.round(green * 255).toString(16).padStart(2, '0')}${Math.round(blue * 255).toString(16).padStart(2, '0')}`;
                    }

                    if (format.textFormat) {
                      if (format.textFormat.foregroundColor) {
                        const { red = 0, green = 0, blue = 0 } = format.textFormat.foregroundColor;
                        convertedFormat.textColor = `#${Math.round(red * 255).toString(16).padStart(2, '0')}${Math.round(green * 255).toString(16).padStart(2, '0')}${Math.round(blue * 255).toString(16).padStart(2, '0')}`;
                      }
                      if (format.textFormat.bold) convertedFormat.fontWeight = 'bold';
                      if (format.textFormat.italic) convertedFormat.fontStyle = 'italic';
                      if (format.textFormat.fontSize) convertedFormat.fontSize = format.textFormat.fontSize;
                    }

                    if (format.horizontalAlignment) {
                      const alignment = format.horizontalAlignment.toLowerCase();
                      if (['left', 'center', 'right'].includes(alignment)) {
                        convertedFormat.textAlign = alignment;
                      }
                    }

                    if (format.borders) {
                      convertedFormat.borders = {};
                      ['top', 'bottom', 'left', 'right'].forEach(side => {
                        const border = format.borders[side];
                        if (border && border.style !== 'NONE') {
                          const color = border.color ? `#${Math.round((border.color.red || 0) * 255).toString(16).padStart(2, '0')}${Math.round((border.color.green || 0) * 255).toString(16).padStart(2, '0')}${Math.round((border.color.blue || 0) * 255).toString(16).padStart(2, '0')}` : '#000000';
                          convertedFormat.borders[side] = {
                            style: border.style.toLowerCase(),
                            color,
                            width: border.width || 1
                          };
                        }
                      });
                    }

                    if (Object.keys(convertedFormat).length > 0) {
                      cellStyles.push({
                        rowIndex,
                        columnIndex: colIndex,
                        format: convertedFormat
                      });
                    }
                  }
                });
              }
            });
          }
          formattingData = cellStyles;
        } catch (error) {
          console.error('Failed to parse formatting data:', error);
        }
      }
      
      console.log('Successfully read sheet data with', sheetData.values?.length || 0, 'rows and', formattingData?.length || 0, 'formatted cells')
      
      return new Response(JSON.stringify({
        sheetName,
        values: sheetData.values || [],
        metadata: {
          title: metadata.properties.title,
          sheetCount: metadata.sheets.length
        },
        formatting: formattingData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Error in google-drive-auth function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
