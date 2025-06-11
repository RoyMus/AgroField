
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
    const { action, code, accessToken } = requestBody
    
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
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.readonly')}&` +
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
