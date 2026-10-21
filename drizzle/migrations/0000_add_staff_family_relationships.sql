CREATE TYPE public.app_role AS ENUM ('owner', 'staff');
CREATE TABLE public.user_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role public.app_role NOT NULL,
 UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own staff roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.has_family_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'staff'));
$$;
REVOKE ALL ON FUNCTION public.has_family_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_family_access() TO authenticated, service_role;
CREATE TABLE public.family_relationships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 member_a uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
 member_b uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
 role_a text NOT NULL,
 role_b text NOT NULL,
 version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT family_order CHECK (member_a < member_b),
 CONSTRAINT family_pair UNIQUE (member_a, member_b),
 CONSTRAINT family_roles CHECK (
 (role_a IN ('Mother','Father') AND role_b = 'Child') OR
 (role_b IN ('Mother','Father') AND role_a = 'Child') OR
 (role_a IN ('Grandmother','Grandfather') AND role_b = 'Grandchild') OR
 (role_b IN ('Grandmother','Grandfather') AND role_a = 'Grandchild') OR
 (role_a IN ('Sister','Brother','Sibling') AND role_b IN ('Sister','Brother','Sibling')) OR
 (role_a = 'Spouse' AND role_b = 'Spouse') OR
 (role_a = 'Guardian' AND role_b = 'Ward') OR (role_b = 'Guardian' AND role_a = 'Ward') OR
 (role_a IN ('Aunt','Uncle') AND role_b IN ('Niece','Nephew')) OR
 (role_b IN ('Aunt','Uncle') AND role_a IN ('Niece','Nephew'))
 )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_relationships TO authenticated;
GRANT ALL ON public.family_relationships TO service_role;
ALTER TABLE public.family_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read family" ON public.family_relationships FOR SELECT TO authenticated USING (public.has_family_access());
CREATE POLICY "Staff insert family" ON public.family_relationships FOR INSERT TO authenticated WITH CHECK (public.has_family_access());
CREATE POLICY "Staff update family" ON public.family_relationships FOR UPDATE TO authenticated USING (public.has_family_access()) WITH CHECK (public.has_family_access());
CREATE POLICY "Staff delete family" ON public.family_relationships FOR DELETE TO authenticated USING (public.has_family_access());
CREATE INDEX family_member_b_idx ON public.family_relationships(member_b);
CREATE FUNCTION public.family_revision() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.version := OLD.version + 1; NEW.updated_at := now(); RETURN NEW; END;
$$;
CREATE TRIGGER family_revision BEFORE UPDATE ON public.family_relationships FOR EACH ROW EXECUTE FUNCTION public.family_revision();
CREATE POLICY "Signed in kiosk member reads" ON public.members FOR SELECT TO authenticated USING (true);
COMMENT ON TABLE public.family_relationships IS 'Staff-only explicit member relationships. Single canonical ordered pair; no children auto-merging. Member deletion cascades only relationship links.';