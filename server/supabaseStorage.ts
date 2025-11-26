import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.warn('VITE_SUPABASE_URL not configured');
}

export const supabaseAdmin: SupabaseClient | null = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuGeneration {
  id: string;
  user_id: string;
  file_name: string;
  extracted_text: string;
  colors: string[];
  size: string;
  style_prompt: string;
  html_variations: string[] | null;
  selected_variation: number | null;
  is_downloaded: boolean;
  created_at: string;
}

export interface InsertMenuGeneration {
  user_id: string;
  file_name: string;
  extracted_text: string;
  colors: string[];
  size: string;
  style_prompt: string;
  html_variations?: string[] | null;
  selected_variation?: number | null;
  is_downloaded?: boolean;
}

export interface ISupabaseStorage {
  getProfile(id: string): Promise<Profile | null>;
  getProfileByEmail(email: string): Promise<Profile | null>;
  getProfileByStripeCustomer(stripeCustomerId: string): Promise<Profile | null>;
  updateProfileStripeInfo(email: string, stripeCustomerId: string, stripeSubscriptionId: string, subscriptionStatus: string): Promise<boolean>;
  
  createMenuGeneration(generation: InsertMenuGeneration): Promise<MenuGeneration | null>;
  getMenuGeneration(id: string): Promise<MenuGeneration | null>;
  getUserGenerations(userId: string): Promise<MenuGeneration[]>;
  updateGenerationDesigns(id: string, htmlVariations: string[]): Promise<boolean>;
  selectGenerationVariation(id: string, variation: number): Promise<boolean>;
}

class SupabaseStorage implements ISupabaseStorage {
  private client: SupabaseClient | null;

  constructor() {
    this.client = supabaseAdmin;
  }

  async getProfile(id: string): Promise<Profile | null> {
    if (!this.client) {
      console.warn('Supabase admin client not configured');
      return null;
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
      }
      return null;
    }

    return data;
  }

  async getProfileByEmail(email: string): Promise<Profile | null> {
    if (!this.client) {
      console.warn('Supabase admin client not configured');
      return null;
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Error fetching profile by email:', error);
      }
      return null;
    }

    return data;
  }

  async getProfileByStripeCustomer(stripeCustomerId: string): Promise<Profile | null> {
    if (!this.client) {
      console.warn('Supabase admin client not configured');
      return null;
    }

    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Error fetching profile by stripe customer:', error);
      }
      return null;
    }

    return data;
  }

  async updateProfileStripeInfo(
    email: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    subscriptionStatus: string
  ): Promise<boolean> {
    if (!this.client) {
      console.warn('Supabase admin client not configured');
      return false;
    }

    const { error } = await this.client
      .from('profiles')
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_status: subscriptionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (error) {
      console.error('Error updating profile stripe info:', error);
      return false;
    }

    console.log(`Updated profile for ${email} with subscription status: ${subscriptionStatus}`);
    return true;
  }

  async createMenuGeneration(generation: InsertMenuGeneration): Promise<MenuGeneration | null> {
    if (!this.client) {
      console.warn('Supabase admin client not configured');
      return null;
    }

    const { data, error } = await this.client
      .from('menu_generations')
      .insert({
        user_id: generation.user_id,
        file_name: generation.file_name,
        extracted_text: generation.extracted_text,
        colors: generation.colors,
        size: generation.size,
        style_prompt: generation.style_prompt,
        html_variations: generation.html_variations || null,
        selected_variation: generation.selected_variation || null,
        is_downloaded: generation.is_downloaded || false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating menu generation:', error);
      return null;
    }

    return data;
  }

  async getMenuGeneration(id: string): Promise<MenuGeneration | null> {
    if (!this.client) {
      console.warn('Supabase admin client not configured');
      return null;
    }

    const { data, error } = await this.client
      .from('menu_generations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Error fetching menu generation:', error);
      }
      return null;
    }

    return data;
  }

  async getUserGenerations(userId: string): Promise<MenuGeneration[]> {
    if (!this.client) {
      console.warn('Supabase admin client not configured');
      return [];
    }

    const { data, error } = await this.client
      .from('menu_generations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user generations:', error);
      return [];
    }

    return data || [];
  }

  async updateGenerationDesigns(id: string, htmlVariations: string[]): Promise<boolean> {
    if (!this.client) {
      console.warn('Supabase admin client not configured');
      return false;
    }

    const { error } = await this.client
      .from('menu_generations')
      .update({ html_variations: htmlVariations })
      .eq('id', id);

    if (error) {
      console.error('Error updating generation designs:', error);
      return false;
    }

    return true;
  }

  async selectGenerationVariation(id: string, variation: number): Promise<boolean> {
    if (!this.client) {
      console.warn('Supabase admin client not configured');
      return false;
    }

    const { error } = await this.client
      .from('menu_generations')
      .update({ selected_variation: variation })
      .eq('id', id);

    if (error) {
      console.error('Error selecting variation:', error);
      return false;
    }

    return true;
  }
}

export const supabaseStorage = new SupabaseStorage();
