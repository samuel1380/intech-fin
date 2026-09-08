-- Transactional migration. Back up production first. Ambiguous legacy ownership aborts.
BEGIN;
CREATE TABLE IF NOT EXISTS public.transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), date date NOT NULL, "serviceDate" date,
 description text NOT NULL, amount numeric NOT NULL, type text NOT NULL, category text NOT NULL,
 status text NOT NULL, notes text, "employeeName" text, "commissionRate" numeric,
 "commissionAmount" numeric, "commissionPaymentDate" date, "pendingAmount" numeric,
 "isRecurring" boolean DEFAULT false, "recurringIntervalMonths" integer, "recurringDay" integer,
 created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tax_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,percentage numeric NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.notification_preferences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text UNIQUE,preferences jsonb NOT NULL DEFAULT '{}',push_subscription jsonb,updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.system_settings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text NOT NULL,value jsonb NOT NULL DEFAULT '{}',updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now());
-- Remove ALL existing permissive policies on owned tables; policies combine with OR.
DO $$ DECLARE t text; p record; owner_id uuid; user_count integer; has_orphans boolean;
BEGIN
 SELECT count(*) INTO user_count FROM auth.users;
 IF user_count=1 THEN SELECT id INTO owner_id FROM auth.users LIMIT 1; END IF;
 FOREACH t IN ARRAY ARRAY['transactions','tax_settings','notification_preferences','system_settings'] LOOP
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
  END LOOP;
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS user_id uuid',t);
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='user_id' AND data_type='text') THEN
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE user_id IS NULL OR user_id = ''intechfin_default'')',t) INTO has_orphans;
   IF has_orphans AND owner_id IS NULL THEN RAISE EXCEPTION 'Ambiguous legacy owner in %. Assign user_id explicitly before migration.',t; END IF;
   EXECUTE format('UPDATE public.%I SET user_id=$1 WHERE user_id IS NULL OR user_id=''intechfin_default''',t) USING owner_id::text;
   EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id DROP DEFAULT',t);
   EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id TYPE uuid USING user_id::uuid',t);
  END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE user_id IS NULL)',t) INTO has_orphans;
  IF has_orphans AND owner_id IS NULL THEN RAISE EXCEPTION 'Ambiguous legacy owner in %. Assign user_id explicitly before migration.',t; END IF;
  EXECUTE format('UPDATE public.%I SET user_id=$1 WHERE user_id IS NULL',t) USING owner_id;
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT auth.uid(), ALTER COLUMN user_id SET NOT NULL',t);
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=format('public.%I',t)::regclass AND conname=t||'_owner_fkey') THEN
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(user_id) REFERENCES auth.users(id)',t,t||'_owner_fkey');
  END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY owner_access ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid())=user_id) WITH CHECK ((SELECT auth.uid())=user_id)',t);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(user_id)',t||'_owner_idx',t);
 END LOOP;
END $$;
-- Replace global uniqueness: two users can each own a profile and keepalive settings.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.system_settings'::regclass AND contype='u' AND pg_get_constraintdef(oid)='UNIQUE (key)' LOOP
  EXECUTE format('ALTER TABLE public.system_settings DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS system_settings_owner_key ON public.system_settings(user_id,key);
CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_owner ON public.notification_preferences(user_id);
CREATE TABLE IF NOT EXISTS public.push_subscriptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 endpoint text NOT NULL CHECK(length(endpoint)<4096 AND endpoint LIKE 'https://%'),subscription jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_access ON public.push_subscriptions;
CREATE POLICY owner_access ON public.push_subscriptions FOR ALL TO authenticated USING ((SELECT auth.uid())=user_id) WITH CHECK ((SELECT auth.uid())=user_id);
REVOKE ALL ON public.push_subscriptions FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.push_subscriptions TO authenticated;
INSERT INTO public.push_subscriptions(user_id,endpoint,subscription)
 SELECT user_id,push_subscription->>'endpoint',push_subscription FROM public.notification_preferences
 WHERE push_subscription->>'endpoint' LIKE 'https://%' ON CONFLICT(user_id,endpoint) DO NOTHING;
UPDATE public.notification_preferences SET push_subscription=NULL WHERE push_subscription IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.maintenance_health(id integer PRIMARY KEY CHECK(id=1),checked_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.maintenance_health(id) VALUES(1) ON CONFLICT DO NOTHING;
ALTER TABLE public.maintenance_health ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.maintenance_health FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.health_check() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT checked_at FROM public.maintenance_health WHERE id=1 $$;
REVOKE ALL ON FUNCTION public.health_check() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.health_check() TO authenticated,service_role;
CREATE TABLE IF NOT EXISTS public.push_deliveries(
 subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
 event_key text NOT NULL,claimed_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,PRIMARY KEY(subscription_id,event_key)
);
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_deliveries FROM anon,authenticated;
GRANT ALL ON public.push_deliveries,public.push_subscriptions,public.maintenance_health TO service_role;
GRANT SELECT ON public.transactions,public.notification_preferences TO service_role;
-- Atomic claim prevents concurrent jobs from sending the same event. Failed sends release their claim.
CREATE OR REPLACE FUNCTION public.claim_push(p_subscription uuid,p_event text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE claimed uuid;
BEGIN
 INSERT INTO public.push_deliveries(subscription_id,event_key) VALUES(p_subscription,p_event)
 ON CONFLICT(subscription_id,event_key) DO UPDATE SET claimed_at=now()
 WHERE public.push_deliveries.sent_at IS NULL AND public.push_deliveries.claimed_at<now()-interval '10 minutes'
 RETURNING subscription_id INTO claimed;
 RETURN claimed IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_push(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push(uuid,text) TO service_role;
-- Reject invalid new financial writes without rewriting legacy data.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='transactions_valid_financial_input' AND conrelid='public.transactions'::regclass) THEN
 ALTER TABLE public.transactions ADD CONSTRAINT transactions_valid_financial_input CHECK(
 amount>=0 AND amount<1e12 AND amount::text NOT IN ('NaN','Infinity','-Infinity') AND length(description) BETWEEN 1 AND 500
 AND type IN ('RECEITA','DESPESA') AND status IN ('CONCLUÍDO','PENDENTE','PAGTO PARCIAL','FALHOU')
 AND ("pendingAmount" IS NULL OR "pendingAmount" BETWEEN 0 AND amount)
 AND ("recurringIntervalMonths" IS NULL OR "recurringIntervalMonths" BETWEEN 1 AND 120)
 AND ("recurringDay" IS NULL OR "recurringDay" BETWEEN 1 AND 31)
 ) NOT VALID;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='tax_settings_valid_input' AND conrelid='public.tax_settings'::regclass) THEN
 ALTER TABLE public.tax_settings ADD CONSTRAINT tax_settings_valid_input CHECK(percentage BETWEEN 0 AND 100 AND length(name) BETWEEN 1 AND 120) NOT VALID;
 END IF;
END $$;
COMMIT;
