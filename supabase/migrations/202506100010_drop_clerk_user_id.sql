-- Remove legacy Clerk-era helper; app uses Supabase auth.uid() only.

drop function if exists public.clerk_user_id();
