import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://xqeuitrtmffiziaqxofh.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_B703J69uNYuyveq59BmV-A_Go7p8yUJ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
