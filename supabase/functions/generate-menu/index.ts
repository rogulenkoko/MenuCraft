import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

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

    const { generationId, menuText, colors, size, stylePrompt } = await req.json();

    if (!menuText || !colors || !size || !stylePrompt || !generationId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const sizeMap: Record<string, string> = {
      a4: '210mm x 297mm',
      letter: '8.5in x 11in',
      a5: '148mm x 210mm',
      'half-letter': '5.5in x 8.5in',
    };
    const sizeDescription = sizeMap[size] || sizeMap.a4;

    const htmlDesigns: string[] = [];

    for (let i = 0; i < 3; i++) {
      const variationStyles = [
        'elegant and sophisticated with subtle gradients and refined typography',
        'bold and modern with strong contrasts and geometric elements',
        'warm and inviting with organic shapes and handcrafted feel',
      ];

      const prompt = `You are an expert menu designer. Create a beautiful, professional HTML menu design.
 
MENU CONTENT:
${menuText}

DESIGN REQUIREMENTS:
- Page size: ${sizeDescription}
- Color palette: ${colors.join(', ')}
- Style: ${stylePrompt}
- Variation style: ${variationStyles[i]}

Create a complete, self-contained HTML document with embedded CSS. The design should be:
1. Print-ready and properly sized for ${sizeDescription}
2. Visually stunning and professional
3. Easy to read with clear hierarchy
4. Using the provided color palette throughout
5. Unique from other variations

Return ONLY the complete HTML code, no explanations. Start with <!DOCTYPE html>.`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content.find((block: any) => block.type === 'text');
      if (textContent && 'text' in textContent) {
        let html = textContent.text;
        const htmlMatch = html.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
        if (htmlMatch) {
          html = htmlMatch[0];
        }
        htmlDesigns.push(html);
      }
    }

    const { error: updateError } = await supabaseClient
      .from('menu_generations')
      .update({ html_variations: htmlDesigns })
      .eq('id', generationId)
      .eq('user_id', user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to save designs' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, count: htmlDesigns.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Menu generation is temporarily unavailable. Please try again later.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
