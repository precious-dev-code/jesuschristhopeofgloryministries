CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_name text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'unmarked',
  last_marked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read members"
  ON public.members FOR SELECT TO anon USING (true);