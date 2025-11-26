import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
} else {
  console.warn('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = supabaseClient as SupabaseClient;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          avatar_url: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          has_activated: boolean;
          menu_credits: number;
          total_generated: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          name?: string | null;
          avatar_url?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          has_activated?: boolean;
          menu_credits?: number;
          total_generated?: number;
        };
        Update: {
          email?: string | null;
          name?: string | null;
          avatar_url?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          has_activated?: boolean;
          menu_credits?: number;
          total_generated?: number;
        };
      };
      menu_generations: {
        Row: {
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
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          extracted_text: string;
          colors: string[];
          size: string;
          style_prompt: string;
          html_variations?: string[] | null;
          selected_variation?: number | null;
          is_downloaded?: boolean;
        };
        Update: {
          html_variations?: string[] | null;
          selected_variation?: number | null;
          is_downloaded?: boolean;
        };
      };
    };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type MenuGeneration = Database['public']['Tables']['menu_generations']['Row'];
export type InsertMenuGeneration = Database['public']['Tables']['menu_generations']['Insert'];
