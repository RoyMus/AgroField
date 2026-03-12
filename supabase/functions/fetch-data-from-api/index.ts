
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
  "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req)=> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
    type ExtractedData = {
        daysinterval: number | null;
        hourlyCyclesPerDay: number | null;
        waterDuration: number | null;
        valveID: number | null;
        fertQuant: number | null;
        waterQuantity: number | null;
        fertProgram: number | null;
        NominalFlow: number | null;
        fertQuantities: number[] | null;
        waterDosageMode: number | null;
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
        fertQuantities: null,
        waterDosageMode: null,
    };
    const extractedDataArray: ExtractedData[] = [];
  try {
        const reqText = await req.json();
        const {platform, externalID,programIDs, APIKey, valveIDs} = reqText;
   
        if (platform === 'gsig' && !isNaN(externalID)) {
          for (let i = 0; i < programIDs.length; i++) {
            const programID = programIDs[i];
            const valveIDInProgram = valveIDs[i];
            const url = `https://gsi.galcon-smart.com/api/api/External/${externalID}/${programID}/ProgramSettings?Key=${APIKey}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.Result && data.Body) {
                extractedData = {
                ...extractedData,
                daysinterval: data.Body.CyclicDayProgram?.DaysInterval,
                hourlyCyclesPerDay: data.Body.HourlyCycle?.HourlyCyclesPerDay,
                waterDuration: data.Body.ValveInProgram?.[valveIDInProgram]?.WaterDuration,
                valveID: data.Body.ValveInProgram?.[valveIDInProgram]?.ValveID,
                fertQuant: data.Body.ValveInProgram?.[valveIDInProgram]?.FertQuant,
                waterQuantity: data.Body.ValveInProgram?.[valveIDInProgram]?.WaterQuantity,
                fertProgram: data.Body.ValveInProgram?.[valveIDInProgram]?.FertProgram,
                };

            if (extractedData.valveID !== undefined) {
                const url2 = `https://gsi.galcon-smart.com/api/api/External/${externalID}/${extractedData.valveID}/ValveSettings?Key=${APIKey}`;

                const response2 = await fetch(url2);
                const data2 = await response2.json();

                if (data2.Result && data2.Body) {
                    extractedData = {
                    ...extractedData,
                    NominalFlow: data2.Body.LastFlow,
                    };
                }
            }
            extractedDataArray.push(extractedData);
          }
        }
      }
      else if (platform === 'talgil' && !isNaN(externalID)) {
        const url = `https://srv.talgil.com/api/targets/${externalID}/programs`;

        const response = await fetch(url,{
          method: 'GET',
          headers: {
            'TLG-API-Key': APIKey
          }
        });
        const responseText = await response.text();
        const data = JSON.parse(responseText);
        if(data)
        {  
            const filtered = data.filter((item: any) => programIDs.includes(item.id));
            for (let i = 0; i < filtered.length; i++) {
              const item = filtered[i];
              const valve = item.valves?.[0];
              if(!valve)
                continue;
              
              extractedData = {
                ...extractedData,
                daysinterval: item.daysCycle ? item.daysCycle: 1,
                hourlyCyclesPerDay: item.cyclesPerStart,
                waterDosageMode: item.waterDosageMode,
                waterDuration: valve.waterPlanned,
                fertQuantities: valve.localFertPlanned,
                NominalFlow: valve.Flow,
                valveID: valve.id,
              };
              console.log(extractedData);
              extractedDataArray.push(extractedData);
            }
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
    return new Response(JSON.stringify(extractedDataArray), { status: 200, headers: corsHeaders });
});