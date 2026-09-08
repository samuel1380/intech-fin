BEGIN;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recurring_parent_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_recurrence_unique ON public.transactions(recurring_parent_id,date) WHERE recurring_parent_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.generate_recurrences() RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE template public.transactions; month_start date; due_date date; today date=(now() AT TIME ZONE 'America/Sao_Paulo')::date; added integer=0; affected integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
 FOR template IN SELECT DISTINCT ON(description,category,amount) * FROM public.transactions
 WHERE user_id=auth.uid() AND "isRecurring"=true AND type='DESPESA' AND recurring_parent_id IS NULL
 ORDER BY description,category,amount,date,id LOOP
  IF coalesce(template."recurringIntervalMonths",1) NOT BETWEEN 1 AND 120 THEN CONTINUE; END IF;
  month_start=date_trunc('month',template.date)::date+make_interval(months=>coalesce(template."recurringIntervalMonths",1));
  FOR counter IN 1..240 LOOP
   EXIT WHEN month_start>today;
   due_date=month_start+(least(greatest(coalesce(template."recurringDay",extract(day FROM template.date)::int),1),extract(day FROM (month_start+interval '1 month -1 day'))::int)-1);
   IF due_date<=today AND NOT EXISTS(SELECT 1 FROM public.transactions WHERE user_id=auth.uid() AND description=template.description AND category=template.category AND amount=template.amount AND date=due_date) THEN
    INSERT INTO public.transactions(user_id,date,description,amount,type,category,status,"isRecurring","recurringIntervalMonths","recurringDay",recurring_parent_id,notes)
    VALUES(auth.uid(),due_date,template.description,template.amount,template.type,template.category,'PENDENTE',true,template."recurringIntervalMonths",template."recurringDay",template.id,'Gerado automaticamente por recorrência') ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS affected=ROW_COUNT; added=added+affected;
   END IF;
   month_start=month_start+make_interval(months=>coalesce(template."recurringIntervalMonths",1));
  END LOOP;
 END LOOP;
 RETURN added;
END $$;
REVOKE ALL ON FUNCTION public.generate_recurrences() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_recurrences() TO authenticated;
COMMIT;
