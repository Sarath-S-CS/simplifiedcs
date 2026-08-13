// Client-side Supabase connection for live, public read-only data (currently
// just news_items - see §1 of the Phase 2 brief). Uses the publishable key,
// which is meant to be embedded in browser code (same key already committed
// in .github/workflows/keep-supabase-alive.yml) - RLS on news_items only
// grants SELECT to anon/authenticated, so this key can never write.
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://xufqgrcxufptlptpwlfi.supabase.co",
  "sb_publishable_rMgv5Ca-_rmygrgsh9Npeg_4vhl11p_"
);
