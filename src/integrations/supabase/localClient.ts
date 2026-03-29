import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const LOCAL_URL = "http://localhost:54321";
// Default anon key for all local Supabase instances
const LOCAL_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7URIqm4AuIQpBxb5Z-ZGnEFwEFSAGhJdHnc";

export const localSupabase = createClient<Database>(LOCAL_URL, LOCAL_ANON_KEY);
