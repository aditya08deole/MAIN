import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { device_id, type, results } = await req.json()

        // 1. Validate permissions and fetch keys server-side
        const { data: device, error } = await supabaseClient
            .from('devices')
            .select('thingspeak_channel_id, thingspeak_read_key')
            .eq('id', device_id)
            .single()

        if (error || !device) {
            throw new Error('Device not found or access denied')
        }

        // 2. Proxy request to ThingSpeak
        // Support for live (latest) vs history
        let tsUrl = "";
        if (type === 'history') {
            const resCount = results || 100;
            tsUrl = `https://api.thingspeak.com/channels/${device.thingspeak_channel_id}/feeds.json?api_key=${device.thingspeak_read_key}&results=${resCount}`;
        } else {
            tsUrl = `https://api.thingspeak.com/channels/${device.thingspeak_channel_id}/feeds/last.json?api_key=${device.thingspeak_read_key}`;
        }

        const tsResponse = await fetch(tsUrl)
        const tsData = await tsResponse.json()

        return new Response(
            JSON.stringify(tsData),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
