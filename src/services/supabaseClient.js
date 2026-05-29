import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lvxlewregtqilzraoxkl.supabase.co";
const supabaseAnonKey = "sb_publishable_5hVK9HIhHJlkRfP3d_0bDA_gW7B1tyT";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);