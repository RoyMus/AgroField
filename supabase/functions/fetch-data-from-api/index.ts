
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
  "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
function createMappingRecords(data: { line: number; position: number; mapped_id: string }[])
{
  const mapping: Record<string, string> = {};
  for (const row of data) {
    mapping[`${row.line}${row.position}`] = row.mapped_id;
  }
  return mapping;
}
async function fetchValvesIds(file_id:string, APIKey:string)
{
  // 2. DB miss — fetch from your API
  const apiRes = await fetch(`https://srv.talgil.com/api/targets/${file_id}/valves`, {
     method: 'GET',
      headers: {
        'TLG-API-Key': APIKey
    }
  });

  if (!apiRes.ok) {
    return null;
  }

  const apiData = await apiRes.json();

  if (!Array.isArray(apiData)) {
    return null;
  }

  const pairs = apiData.map((item: any) => ({
    line: item.line,
    position: item.position,
    mapped_id: item.uid,
  }));

  return createMappingRecords(pairs);

}
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
        fertLocalModes: number[] | null;
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
        fertLocalModes: null,
    };
    const extractedDataArray: ExtractedData[] = [];
  try {
        const reqText = await req.json();
        const {platform, externalIDs, programIDs, APIKey, valveIDs} = reqText;
        if (platform === 'gsig') {
          for (let i = 0; i < programIDs.length; i++) {
            const externalID = externalIDs[i];
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
      else if (platform === 'talgil') {
        const valvesMapping = await fetchValvesIds(externalIDs[0], APIKey);
        console.log(JSON.stringify(valvesMapping, null, 2));
        await sleep(1000); // Ensure we respect any potential rate limits after fetching valve IDs
        const map = new Map();
        for (let i = 0; i < externalIDs.length; i++)
        {
          var innerExternalID = externalIDs[i];
          if (!map.has(innerExternalID))
          {
            map.set(innerExternalID, []);
          }
          map.get(innerExternalID).push(programIDs[i]);
        }
        console.log(map);

        let shouldAwait = false;
        for (const externalID of map.keys())
        {
          if (shouldAwait)
          {
            await sleep(1000);
          }
          else
          {
            shouldAwait = true;
          }
          const url = `https://srv.talgil.com/api/targets/${externalID}/programs`;

          const response = await fetch(url,{
            method: 'GET',
            headers: {
              'TLG-API-Key': APIKey
            }
          });
          const responseText = await response.text();
          const data = JSON.parse(responseText);
          console.log(data);
          if(data && Array.isArray(data))
          {  
              const order = map.get(externalID);
              // Keep programs indexed by id for quick lookup
              const programsById = new Map(data.map((item: any) => [item.id + 1, item]));

              for (let i = 0; i < order.length; i++) {
                const programID = order[i];
                const item = programsById.get(programID);
                
                if (!item) continue;

                let valves: any[] = [];

                if (valvesMapping !== null) {
                  const valveID = valvesMapping[valveIDs[i]];
                  if (valveID) {
                    const matched = item.valves?.find((v: any) => v.valve === valveID);
                    valves = matched ? [matched] : [item.valves?.[0]].filter(Boolean);
                  } else {
                    valves = [item.valves?.[0]].filter(Boolean);
                  }
                }
                else
                {
                  valves = [item.valves?.[0]].filter(Boolean);
                }
                // If still no valves at all, skip this program
                if (valves.length === 0) continue;

                let daysCycle = item.daysCycle == 0 ? 1 : item.daysCycle;

                for (const valve of valves) {
                  extractedData = {
                    ...extractedData,
                    fertProgram: item.name,
                    daysinterval: daysCycle,
                    hourlyCyclesPerDay: item.cyclesPerStart == 0 ? 1 : item.cyclesPerStart,
                    waterDosageMode: valve.waterDosageMode,
                    waterDuration: valve.waterPlanned,
                    waterQuantity: valve.waterPlanned, // Assuming waterQuantity is the same as waterPlanned
                    NominalFlow: valve.flow,
                    valveID: valve.valve,
                    fertQuantities: valve.localFertPlanned,
                    fertLocalModes: valve.localFertMode
                  };

                  extractedDataArray.push(extractedData);
                }
              }
          }
        }
        console.log("Final Array: " + extractedDataArray);
      }
      else
      {
          return new Response(JSON.stringify({ error: "API לא זוהתה פלטפורמת" }), { status: 400, headers: corsHeaders });
      }
    }
    catch (error) {
        console.error("Error fetching data from API:", error);
        return new Response(JSON.stringify({ error: "אנא ודא שהמפתח תקין ,שגיאה באיסוף נתונים" }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify(extractedDataArray), { status: 200, headers: corsHeaders });
});