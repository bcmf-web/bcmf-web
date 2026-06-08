import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://lvxlewregtqilzraoxkl.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2eGxld3JlZ3RxaWx6cmFveGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjUzMzAsImV4cCI6MjA5NTU0MTMzMH0.axt9gsmoFYJvPtnqES0vwfKhkMfzNzSt9za8SyiGiHo";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);