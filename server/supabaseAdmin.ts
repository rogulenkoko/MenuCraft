import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export async function updateSupabaseProfile(
  email: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  subscriptionStatus: string
): Promise<boolean> {
  if (!supabaseAdmin) {
    console.warn('Supabase admin client not configured - cannot update profile');
    return false;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_status: subscriptionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email);

    if (error) {
      console.error('Error updating Supabase profile:', error);
      return false;
    }

    console.log(`Updated Supabase profile for ${email} with status: ${subscriptionStatus}`);
    return true;
  } catch (error) {
    console.error('Error updating Supabase profile:', error);
    return false;
  }
}
