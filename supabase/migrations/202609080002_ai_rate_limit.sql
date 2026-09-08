BEGIN;
CREATE TABLE IF NOT EXISTS public.ai_rate_limits(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,window_start timestamptz NOT NULL,requests integer NOT NULL);
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_rate_limits FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.claim_ai_request() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result integer;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 INSERT INTO public.ai_rate_limits VALUES(auth.uid(),now(),1)
 ON CONFLICT(user_id) DO UPDATE SET
 requests=CASE WHEN public.ai_rate_limits.window_start<now()-interval '1 hour' THEN 1 ELSE public.ai_rate_limits.requests+1 END,
 window_start=CASE WHEN public.ai_rate_limits.window_start<now()-interval '1 hour' THEN now() ELSE public.ai_rate_limits.window_start END
 WHERE public.ai_rate_limits.window_start<now()-interval '1 hour' OR public.ai_rate_limits.requests<20
 RETURNING requests INTO result;
 RETURN result IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_ai_request() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_ai_request() TO authenticated;
COMMIT;
