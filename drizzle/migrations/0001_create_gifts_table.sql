CREATE TABLE public.gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  device_token uuid,
  donor_email text NOT NULL,
  donor_name text,
  prayer_request text,
  gift_type text NOT NULL CHECK (gift_type IN ('Tithe','Offering','Special Project')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Paid','Failed')),
  confirmed_via text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gifts TO anon, authenticated;
GRANT ALL ON public.gifts TO service_role;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.has_giving_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','staff')
  );
$$;
REVOKE ALL ON FUNCTION public.has_giving_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_giving_access() TO authenticated, service_role;

-- Donors are anonymous: their device token (sent as an HTTP header, stored in
-- browser localStorage only) is the capability that scopes their history.
CREATE POLICY "Donors read own device gifts" ON public.gifts
FOR SELECT TO anon, authenticated
USING (
  device_token IS NOT NULL
  AND device_token::text = COALESCE(
    NULLIF(current_setting('request.headers', true), '')::json ->> 'x-giving-device-token',
    ''
  )
);
-- Church-wide giving history is for approved finance/admin users only.
-- Roles are assigned out-of-band in user_roles; never through public signup.
CREATE POLICY "Finance staff read all gifts" ON public.gifts
FOR SELECT TO authenticated
USING (public.has_giving_access());

CREATE INDEX gifts_device_token_idx ON public.gifts(device_token);
CREATE INDEX gifts_created_at_idx ON public.gifts(created_at DESC);

CREATE FUNCTION public.gift_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
CREATE TRIGGER gifts_touch BEFORE UPDATE ON public.gifts
FOR EACH ROW EXECUTE FUNCTION public.gift_touch();

-- Idempotent confirmation: verifies reference, amount and currency before
-- marking Paid. Retries (webhook redelivery, duplicate events, return-visit
-- verification) can never duplicate a gift or re-confirm a settled one.
CREATE FUNCTION public.confirm_gift(p_reference text, p_amount_cents integer, p_currency text, p_via text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_status text;
  current_amount integer;
  current_currency text;
BEGIN
  UPDATE public.gifts
     SET status = 'Paid', paid_at = now(), confirmed_via = p_via
   WHERE reference = p_reference
     AND amount_cents = p_amount_cents
     AND currency = p_currency
     AND status = 'Pending';
  IF FOUND THEN RETURN 'Paid'; END IF;

  SELECT status, amount_cents, currency
    INTO current_status, current_amount, current_currency
    FROM public.gifts
   WHERE reference = p_reference;
  IF NOT FOUND THEN RETURN 'Unknown'; END IF;
  IF current_status = 'Paid' AND current_amount = p_amount_cents AND current_currency = p_currency THEN
    RETURN 'Already';
  END IF;
  RETURN 'Mismatch';
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_gift(text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_gift(text, integer, text, text) TO service_role;

CREATE FUNCTION public.fail_gift(p_reference text, p_via text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_status text;
BEGIN
  UPDATE public.gifts
     SET status = 'Failed', confirmed_via = p_via
   WHERE reference = p_reference AND status = 'Pending';
  IF FOUND THEN RETURN 'Failed'; END IF;
  SELECT status INTO current_status FROM public.gifts WHERE reference = p_reference;
  IF NOT FOUND THEN RETURN 'Unknown'; END IF;
  IF current_status = 'Failed' THEN RETURN 'Already'; END IF;
  RETURN 'Mismatch';
END;
$$;
REVOKE ALL ON FUNCTION public.fail_gift(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fail_gift(text, text) TO service_role;

COMMENT ON TABLE public.gifts IS 'Persistent giving records. Pending is created server-side before Paystack checkout; only confirm_gift/fail_gift (verified amount, currency and reference) change status. Donors read only their device token''s rows; owner/staff read church-wide.';