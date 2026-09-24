// Client-side Supabase connection for live, public, read-only data (the
// News, Exploit Tracker and Case Studies feeds). Uses the publishable key,
// which is meant to be embedded in browser code - table grants and RLS allow
// only SELECT for anon/authenticated (see supabase/migrations/ and
// test/supabase-policies.test.js), so this key can't write.
//
// Loaded on demand: the client library is ~200 KB and only the feed pages
// need it, so it's fetched the first time one of them is opened.
const SUPABASE_URL = "https://xufqgrcxufptlptpwlfi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rMgv5Ca-_rmygrgsh9Npeg_4vhl11p_";

let clientPromise = null;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY));
    clientPromise.catch(() => {
      clientPromise = null; // allow a retry after a failed chunk load
    });
  }
  return clientPromise;
}
