import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// null when not configured (see assets/js/env.js) - every caller must
// handle that case instead of crashing the whole page, since this module
// is imported (transitively, via auth.js) by layout.js on every page.
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
