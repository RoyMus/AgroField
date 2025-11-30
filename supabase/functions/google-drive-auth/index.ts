import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Read the request body once and store it
    const requestBody = await req.json();
    const { action, code, accessToken, fileId, sheetName } = requestBody;
    console.log('Request action:', action);
    const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
    const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Google Drive credentials not configured');
    }
    if (action === 'getAuthUrl') {
      const redirectUri = `${req.headers.get('origin')}/`;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + `client_id=${CLIENT_ID}&` + `redirect_uri=${encodeURIComponent(redirectUri)}&` + `response_type=code&` + `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets')}&` + `access_type=offline&` + `prompt=consent`;
      console.log('Generated auth URL for redirect URI:', redirectUri);
      return new Response(JSON.stringify({
        authUrl
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (action === 'exchangeCode') {
      const redirectUri = `${req.headers.get('origin')}/`;
      console.log('Exchanging code for access token with redirect URI:', redirectUri);
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData);
        throw new Error(`Token exchange failed: ${tokenData.error}`);
      }
      console.log('Token exchange successful, includes refresh token:', !!tokenData.refresh_token);
      return new Response(JSON.stringify(tokenData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (action === 'refreshToken') {
      const { refreshToken } = requestBody;
      console.log('Refreshing access token');
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        console.error('Token refresh failed:', tokenData);
        throw new Error(`Token refresh failed: ${tokenData.error}`);
      }
      console.log('Token refresh successful');
      return new Response(JSON.stringify(tokenData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (action === 'listFiles') {
      console.log('Listing Google Drive files');
      
      if (!accessToken) {
        throw new Error('Access token is required for listFiles action');
      }
      
      const filesResponse = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.spreadsheet"&fields=files(id,name,modifiedTime)', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const filesData = await filesResponse.json();
      if (!filesResponse.ok) {
        console.error('Failed to fetch files:', filesData);
        throw new Error(`Failed to fetch files: ${JSON.stringify(filesData.error)}`);
      }
      console.log('Successfully fetched', filesData.files?.length || 0, 'files');
      return new Response(JSON.stringify(filesData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (action === 'readSheet') {
      console.log('Reading Google Sheet data for file:', fileId, 'sheet:', sheetName);
      
      if (!accessToken) {
        throw new Error('Access token is required for readSheet action');
      }
      
      // First, get sheet metadata to find available sheets
      const metadataResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (!metadataResponse.ok) {
        const errorData = await metadataResponse.json();
        console.error('Failed to fetch sheet metadata:', errorData);
        throw new Error(`Failed to fetch sheet metadata: ${errorData.error?.message}`);
      }
      const metadata = await metadataResponse.json();
      
      // Use provided sheetName or default to first sheet
      const targetSheet = sheetName 
        ? metadata.sheets.find((sheet: any) => sheet.properties.title === sheetName)
        : metadata.sheets[0];
      
      if (!targetSheet) {
        throw new Error(`Sheet "${sheetName}" not found`);
      }
      
      const selectedSheetName = targetSheet.properties.title;
      console.log('Reading data from sheet:', selectedSheetName);
      // Get the data from the selected sheet
      const dataResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(selectedSheetName)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (!dataResponse.ok) {
        const errorData = await dataResponse.json();
        console.error('Failed to fetch sheet data:', errorData);
        throw new Error(`Failed to fetch sheet data: ${errorData.error?.message}`);
      }
      const sheetData = await dataResponse.json();
      // Get formatting data for the selected sheet only
      const formattingResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}?ranges=${encodeURIComponent(selectedSheetName)}&fields=sheets(data(rowData(values(effectiveFormat,userEnteredFormat))))`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      let formattingData = null;
      if (formattingResponse.ok) {
        try {
          const formatData = await formattingResponse.json();
          const sourceFormatting = formatData.sheets?.[0]?.data?.[0];
          // Extract cell formatting using utility function
          const cellStyles: any[] = [];
          if (sourceFormatting?.rowData) {
            sourceFormatting.rowData.forEach((row: any, rowIndex: number)=>{
              if (row.values) {
                row.values.forEach((cell: any, colIndex: number)=>{
                  if (cell.userEnteredFormat || cell.effectiveFormat) {
                    const format = cell.effectiveFormat || cell.userEnteredFormat;
                    // Helper function to convert normalized RGB to hex
                    const normalizedRgbToHex = (red: number, green: number, blue: number)=>{
                      const toHex = (val: number)=>{
                        const hex = Math.round(Math.max(0, Math.min(255, val * 255))).toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                      };
                      return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
                    };
                    // Convert Google Sheets format to our format with proper color handling
                    const convertedFormat: any = {};
                    // Handle background color - only if explicitly set and not white
                    if (format.backgroundColor) {
                      const { red, green, blue } = format.backgroundColor;
                      // Google Sheets may omit channels; default missing channels to 0
                      const r = red ?? 0;
                      const g = green ?? 0;
                      const b = blue ?? 0;
                      // Don't add white backgrounds as they're default
                      if (!(r >= 0.99 && g >= 0.99 && b >= 0.99)) {
                        convertedFormat.backgroundColor = normalizedRgbToHex(r, g, b);
                      }
                    }
                    if (format.textFormat) {
                      // Handle text color - only if explicitly set and not black
                      if (format.textFormat.foregroundColor) {
                        const { red, green, blue } = format.textFormat.foregroundColor;
                        const r = red ?? 0;
                        const g = green ?? 0;
                        const b = blue ?? 0;
                        // Don't add black text as it's default
                        if (!(r <= 0.01 && g <= 0.01 && b <= 0.01)) {
                          convertedFormat.textColor = normalizedRgbToHex(r, g, b);
                        }
                      }
                      if (format.textFormat.bold) convertedFormat.fontWeight = 'bold';
                      if (format.textFormat.italic) convertedFormat.fontStyle = 'italic';
                      if (format.textFormat.fontSize) convertedFormat.fontSize = format.textFormat.fontSize;
                    }
                    if (format.horizontalAlignment) {
                      const alignment = format.horizontalAlignment.toLowerCase();
                      if ([
                        'left',
                        'center',
                        'right'
                      ].includes(alignment)) {
                        convertedFormat.textAlign = alignment;
                      }
                    }
                    if (format.borders) {
                      convertedFormat.borders = {};
                      [
                        'top',
                        'bottom',
                        'left',
                        'right'
                      ].forEach((side)=>{
                        const border = format.borders[side];
                        if (border && border.style !== 'NONE') {
                          let color = '#000000';
                          if (border.color) {
                            const { red = 0, green = 0, blue = 0 } = border.color;
                            color = normalizedRgbToHex(red, green, blue);
                          }
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
          console.log('Extracted', cellStyles.length, 'formatted cells from Google Sheets');
          // Log sample of formatting for debugging
          if (cellStyles.length > 0) {
            console.log('Sample formatting styles:', JSON.stringify(cellStyles.slice(0, 3), null, 2));
          }
        } catch (error) {
          console.error('Failed to parse formatting data:', error);
        }
      }
      console.log('Successfully read sheet data with', sheetData.values?.length || 0, 'rows and', formattingData?.length || 0, 'formatted cells');
      return new Response(JSON.stringify({
        sheetName: selectedSheetName,
        values: sheetData.values || [],
        metadata: {
          title: metadata.properties.title,
          sheetCount: metadata.sheets.length,
          availableSheets: metadata.sheets.map((sheet: any) => ({
            id: sheet.properties.sheetId,
            title: sheet.properties.title,
            index: sheet.properties.index
          }))
        },
        formatting: formattingData
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Read all sheets action
    if (action === 'readAllSheets') {
      const { fileId } = requestBody;
      
      if (!fileId) {
        return new Response(
          JSON.stringify({ error: 'File ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: 'Access token is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Get spreadsheet metadata (only sheet properties)
        const metadataResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=properties.title,sheets.properties`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );

        if (!metadataResponse.ok) {
          throw new Error(`Failed to fetch spreadsheet metadata: ${metadataResponse.statusText}`);
        }

        const metadata = await metadataResponse.json();
        
        const sheets = await Promise.all(metadata.sheets.map(async (sheet: any) => {
          const sheetName = sheet.properties.title;
          
          // Fetch values for this sheet
          const dataResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${encodeURIComponent(sheetName)}`,
            {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            }
          );
          const data = await dataResponse.json();

          // Fetch formatting for this sheet
          const formattingResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${fileId}?ranges=${encodeURIComponent(sheetName)}&fields=sheets(data(rowData(values(effectiveFormat,userEnteredFormat))))`,
            {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            }
          );
          const formattingData = await formattingResponse.json();
          
          // Extract formatting
          const sheetData = formattingData.sheets?.[0]?.data?.[0];
          let formatting: any[] = [];
          if (sheetData?.rowData) {
            sheetData.rowData.forEach((row: any, rowIndex: number) => {
              if (row.values) {
                row.values.forEach((cell: any, colIndex: number) => {
                 if (cell.userEnteredFormat || cell.effectiveFormat) {
                    const format = cell.effectiveFormat || cell.userEnteredFormat;
                    // Helper function to convert normalized RGB to hex
                    const normalizedRgbToHex = (red: number, green: number, blue: number)=>{
                      const toHex = (val: number)=>{
                        const hex = Math.round(Math.max(0, Math.min(255, val * 255))).toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                      };
                      return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
                    };
                    // Convert Google Sheets format to our format with proper color handling
                    const convertedFormat: any = {};
                    // Handle background color - only if explicitly set and not white
                    if (format.backgroundColor) {
                      const { red, green, blue } = format.backgroundColor;
                      // Google Sheets may omit channels; default missing channels to 0
                      const r = red ?? 0;
                      const g = green ?? 0;
                      const b = blue ?? 0;
                      // Don't add white backgrounds as they're default
                      if (!(r >= 0.99 && g >= 0.99 && b >= 0.99)) {
                        convertedFormat.backgroundColor = normalizedRgbToHex(r, g, b);
                      }
                    }
                    if (format.textFormat) {
                      // Handle text color - only if explicitly set and not black
                      if (format.textFormat.foregroundColor) {
                        const { red, green, blue } = format.textFormat.foregroundColor;
                        const r = red ?? 0;
                        const g = green ?? 0;
                        const b = blue ?? 0;
                        // Don't add black text as it's default
                        if (!(r <= 0.01 && g <= 0.01 && b <= 0.01)) {
                          convertedFormat.textColor = normalizedRgbToHex(r, g, b);
                        }
                      }
                      if (format.textFormat.bold) convertedFormat.fontWeight = 'bold';
                      if (format.textFormat.italic) convertedFormat.fontStyle = 'italic';
                      if (format.textFormat.fontSize) convertedFormat.fontSize = format.textFormat.fontSize;
                    }
                    if (format.horizontalAlignment) {
                      const alignment = format.horizontalAlignment.toLowerCase();
                      if ([
                        'left',
                        'center',
                        'right'
                      ].includes(alignment)) {
                        convertedFormat.textAlign = alignment;
                      }
                    }
                    if (format.borders) {
                      convertedFormat.borders = {};
                      [
                        'top',
                        'bottom',
                        'left',
                        'right'
                      ].forEach((side)=>{
                        const border = format.borders[side];
                        if (border && border.style !== 'NONE') {
                          let color = '#000000';
                          if (border.color) {
                            const { red = 0, green = 0, blue = 0 } = border.color;
                            color = normalizedRgbToHex(red, green, blue);
                          }
                          convertedFormat.borders[side] = {
                            style: border.style.toLowerCase(),
                            color,
                            width: border.width || 1
                          };
                        }
                      });
                    }
                    if (Object.keys(convertedFormat).length > 0) {
                      formatting.push({
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

          return {
            sheetName,
            sheetId: sheet.properties.sheetId,
            values: data.values || [[]],
            formatting,
            properties: sheet.properties,
            metadata: {
              title: metadata.properties.title,
              sheetCount: metadata.sheets.length,
              availableSheets: metadata.sheets.map((s: any) => ({
                id: s.properties.sheetId,
                title: s.properties.title,
                index: s.properties.index
              }))
            }
          };
        }));

        return new Response(
          JSON.stringify({ sheets }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error: any) {
        console.error('Error reading all sheets:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    throw new Error('Invalid action');
  } catch (error: any) {
    console.error('Error in google-drive-auth function:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Unknown error'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
