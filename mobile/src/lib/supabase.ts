import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://jlwrbbevbugurtkkojfx.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsd3JiYmV2YnVndXJ0a2tvamZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjIyMDgsImV4cCI6MjA4Njg5ODIwOH0._eIxPEExRBinpvOc_6T2RC5Yy0yPzrpsVC5mIU_t07w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native – no URL schemes
  },
});
