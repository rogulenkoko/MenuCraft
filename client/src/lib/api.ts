import { supabase, MenuGeneration, InsertMenuGeneration } from './supabase';

export async function uploadFile(file: File): Promise<{ text: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await supabase.functions.invoke('extract-text', {
      body: formData,
    });

    if (error) throw error;

    return { text: data.text };
  } catch (error: any) {
    console.error('Upload error:', error);
    return { text: '', error: error.message || 'Failed to extract text from file' };
  }
}

export interface GenerateMenuParams {
  fileName: string;
  extractedText: string;
  colors: string[];
  size: string;
  stylePrompt: string;
}

export async function generateMenu(params: GenerateMenuParams): Promise<{ generation: MenuGeneration | null; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { generation: null, error: 'Not authenticated' };
    }

    const { data: generation, error: insertError } = await supabase
      .from('menu_generations')
      .insert({
        user_id: user.id,
        file_name: params.fileName,
        extracted_text: params.extractedText,
        colors: params.colors,
        size: params.size,
        style_prompt: params.stylePrompt,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const { data: aiResult, error: aiError } = await supabase.functions.invoke('generate-menu', {
      body: {
        generationId: generation.id,
        menuText: params.extractedText,
        colors: params.colors,
        size: params.size,
        stylePrompt: params.stylePrompt,
      },
    });

    if (aiError) throw aiError;

    const { data: updatedGeneration, error: fetchError } = await supabase
      .from('menu_generations')
      .select('*')
      .eq('id', generation.id)
      .single();

    if (fetchError) throw fetchError;

    return { generation: updatedGeneration };
  } catch (error: any) {
    console.error('Generation error:', error);
    return { generation: null, error: error.message || 'Failed to generate menu designs' };
  }
}

export async function getUserGenerations(): Promise<{ generations: MenuGeneration[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('menu_generations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return { generations: data || [] };
  } catch (error: any) {
    console.error('Fetch error:', error);
    return { generations: [], error: error.message };
  }
}

export async function getGeneration(id: string): Promise<{ generation: MenuGeneration | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('menu_generations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return { generation: data };
  } catch (error: any) {
    console.error('Fetch error:', error);
    return { generation: null, error: error.message };
  }
}

export async function selectVariation(generationId: string, variationIndex: number): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('menu_generations')
      .update({ selected_variation: variationIndex })
      .eq('id', generationId);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Select error:', error);
    return { success: false, error: error.message };
  }
}

export async function downloadVariation(generationId: string, variationIndex: number): Promise<{ html: string | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('menu_generations')
      .select('html_variations')
      .eq('id', generationId)
      .single();

    if (error) throw error;

    if (!data.html_variations || !data.html_variations[variationIndex]) {
      return { html: null, error: 'Design not found' };
    }

    await supabase
      .from('menu_generations')
      .update({ is_downloaded: true })
      .eq('id', generationId);

    return { html: data.html_variations[variationIndex] };
  } catch (error: any) {
    console.error('Download error:', error);
    return { html: null, error: error.message };
  }
}
