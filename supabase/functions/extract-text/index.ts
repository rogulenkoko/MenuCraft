import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileName = file.name.toLowerCase();
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let text = '';

    if (fileName.endsWith('.pdf')) {
      text = await extractPdfText(bytes);
    } else if (fileName.endsWith('.docx')) {
      text = await extractDocxText(bytes);
    } else if (fileName.endsWith('.txt')) {
      text = new TextDecoder().decode(bytes);
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported file type. Please upload PDF, DOCX, or TXT' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Could not extract text from file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ text: text.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Extraction error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to extract text from file' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const content = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const textMatches = content.match(/\(([^)]+)\)/g) || [];
  const extractedText = textMatches
    .map(match => match.slice(1, -1))
    .filter(text => text.length > 0 && !/^[0-9.]+$/.test(text))
    .join(' ');

  if (extractedText.length > 50) {
    return extractedText;
  }

  const streamMatches = content.match(/stream[\s\S]*?endstream/g) || [];
  let streamText = '';
  for (const stream of streamMatches) {
    const cleanedStream = stream
      .replace(/stream\s*/, '')
      .replace(/\s*endstream/, '')
      .replace(/[^\x20-\x7E\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanedStream.length > 10) {
      streamText += cleanedStream + ' ';
    }
  }

  return streamText || extractedText || 'Unable to extract text from this PDF. Please try a different file or paste your menu content directly.';
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const content = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const textMatches = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
  const extractedText = textMatches
    .map(match => {
      const textMatch = match.match(/>([^<]+)</);
      return textMatch ? textMatch[1] : '';
    })
    .filter(text => text.length > 0)
    .join(' ');

  return extractedText || 'Unable to extract text from this DOCX. Please try a different file or paste your menu content directly.';
}
