CREATE TABLE public.children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name text NOT NULL,
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  status text NOT NULL DEFAULT 'checked_out',
  last_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.children TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.children TO authenticated;
GRANT ALL ON public.children TO service_role;

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view children" ON public.children
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE TABLE public.check_in_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.check_in_logs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_in_logs TO authenticated;
GRANT ALL ON public.check_in_logs TO service_role;

ALTER TABLE public.check_in_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view check-in logs" ON public.check_in_logs
  FOR SELECT TO anon, authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.children;

INSERT INTO public.children (child_name, parent_name, parent_phone) VALUES
  ('Aiden Mthembu', 'Sipho Mthembu', '+27 82 123 4567'),
  ('Lerato Nkosi', 'Thandiwe Nkosi', '+27 83 234 5678'),
  ('Joshua Pillay', 'David Pillay', '+27 84 345 6789'),
  ('Emma van der Merwe', 'Annelize van der Merwe', '+27 72 456 7890'),
  ('Naledi Khumalo', 'Bongani Khumalo', '+27 73 567 8901'),
  ('Daniel Botha', 'Marta Botha', '+27 76 678 9012'),
  ('Sophie Dube', 'Nomsa Dube', '+27 81 789 0123'),
  ('Lucas Anderson', 'Peter Anderson', '+27 82 890 1234'),
  ('Amara Jacobs', 'Fatima Jacobs', '+27 83 901 2345'),
  ('Tinashe Moyo', 'Grace Moyo', '+27 84 012 3456');