
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
  "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
serve(async (req)=> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
    const talgilAPIKey = Deno.env.get("TLG_API_KEY");
    const gsigAPIKey = Deno.env.get("GSI_API_KEY");

    type ExtractedData = {
        daysinterval: number | null;
        hourlyCyclesPerDay: number | null;
        waterDuration: number | null;
        valveID: number | null;
        fertQuant: number | null;
        waterQuantity: number | null;
        fertProgram: number | null;
        NominalFlow: number | null;
    };
    let extractedData :ExtractedData = {
        daysinterval: null,
        hourlyCyclesPerDay: null,
        waterDuration: null,
        valveID: null,
        fertQuant: null,
        waterQuantity: null,
        fertProgram: null,
        NominalFlow: null,
    };
  try {
        const reqText = await req.json();
        console.log(reqText);
        const {platform, externalID,programID} = reqText;
   
        if (platform === 'gsig' && !isNaN(externalID)) {
            const url = `https://gsi.galcon-smart.com/api/api/External/${externalID}/${programID}/ProgramSettings?Key=${gsigAPIKey}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.Result && data.Body) {
                extractedData = {
                ...extractedData,
                daysinterval: data.Body.CyclicDayProgram?.DaysInterval,
                hourlyCyclesPerDay: data.Body.HourlyCycle?.HourlyCyclesPerDay,
                waterDuration: data.Body.ValveInProgram?.[0]?.WaterDuration,
                valveID: data.Body.ValveInProgram?.[0]?.ValveID,
                fertQuant: data.Body.ValveInProgram?.[0]?.FertQuant,
                waterQuantity: data.Body.ValveInProgram?.[0]?.WaterQuantity,
                fertProgram: data.Body.ValveInProgram?.[0]?.FertProgram,
                };

                if (extractedData.valveID !== undefined) {
                const url2 = `https://gsi.galcon-smart.com/api/api/External/${externalID}/${extractedData.valveID}/ValveSettings?Key=${gsigAPIKey}`;

                const response2 = await fetch(url2);
                const data2 = await response2.json();

                if (data2.Result && data2.Body) {
                    extractedData = {
                    ...extractedData,
                    NominalFlow: data2.Body.SetupNominalFlow,
                    };
                }
            }
          }
      }
      else if (platform === 'talgil' && !isNaN(externalID)) {
          const url = `https://dev.talgil.com/api/targets/${externalID}/programs/${programID}`;

          const response = await fetch(url,{
            method: 'GET',
            headers: {
              'TLG-API-Key': talgilAPIKey
            }
          });
          const responseText = await response.text();
          const data = JSON.parse(responseText);
          
          if(data)
          {     
            const valve = data.valves?.[0];
            extractedData = {
              ...extractedData,
              daysinterval: 1,
              hourlyCyclesPerDay: data.cyclesPerStart,
              waterDuration: valve.waterPlanned,
              fertQuant: valve.localFertPlanned?.[0],
              waterQuantity: valve.waterPlanned,
              fertProgram: data.name,
            };
            extractedData = {
              ...extractedData,
              NominalFlow: valve.Flow,
            };
          }
        }
        else
        {
            return new Response(JSON.stringify({ error: "API לא זוהתה פלטפורמת" }), { status: 400, headers: corsHeaders });
        }
    }
    catch (error) {
        console.error("Error fetching data from API:", error);
        return new Response(JSON.stringify({ error: "שגיאה באיסוף נתונים" }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify(extractedData), { status: 200, headers: corsHeaders });
});