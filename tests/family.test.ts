import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalRelationship, relativeView, relationshipInput, reciprocals, assertStaffAccess } from '../src/lib/family';

const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const staff = '00000000-0000-4000-8000-000000000003';
const stranger = '00000000-0000-4000-8000-000000000004';
const migration = readFileSync(new URL('../drizzle/migrations/0000_add_staff_family_relationships.sql', import.meta.url), 'utf8');
describe('explicit reciprocal rules', () => {
  for (const [role, alternatives] of Object.entries(reciprocals)) {
    for (const reciprocalRole of alternatives) it(`${role} ↔ ${reciprocalRole}`, () => {
      const input = relationshipInput.parse({ personId: a, relativeId: b, role, reciprocalRole });
      const canonical = canonicalRelationship(input);
      const link = { ...canonical, id: a, version: 1 };
      expect(relativeView(link, b)).toEqual({ relativeId: a, role: reciprocalRole, reciprocalRole: role });
      expect(canonicalRelationship({ ...input, personId: b, relativeId: a, role: reciprocalRole, reciprocalRole: input.role })).toEqual(canonical);
    });
  }
  it('rejects self-links', () => expect(() => relationshipInput.parse({ personId: a, relativeId: a, role: 'Spouse', reciprocalRole: 'Spouse' })).toThrow());
  it('requires explicit compatible role for a sister', () => expect(() => relationshipInput.parse({ personId: a, relativeId: b, role: 'Sister', reciprocalRole: 'Child' })).toThrow());
  it('default denies unknown or false staff authorization', () => { for (const value of [false, null, undefined]) expect(() => assertStaffAccess(value)).toThrow('Staff access required'); expect(() => assertStaffAccess(true)).not.toThrow(); });
});

describe('real SQL storage and authorization (isolated PostgreSQL)', () => {
  let db: PGlite;
  let directory: string;
  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'family-test-'));
    db = new PGlite(directory);
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      CREATE TABLE public.members(id uuid PRIMARY KEY, member_name text); ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON public.members TO authenticated;
      INSERT INTO auth.users VALUES ('${staff}'),('${stranger}');
      INSERT INTO public.members VALUES ('${a}','Isolated person A'),('${b}','Isolated person B');`);
    await db.exec(migration);
    await db.exec(`INSERT INTO public.user_roles(user_id,role) VALUES ('${staff}','staff');`);
  }, 30000);
  afterAll(async () => { await db.close(); rmSync(directory, { recursive: true, force: true }); });
  async function asUser(id: string, sql: string) {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${id}';`);
    try { return await db.query(sql); } finally { await db.exec('RESET ROLE;'); }
  }
  it('anonymous cannot read or write graph', async () => {
    await db.exec('SET ROLE anon;');
    try {
      await expect(db.query('SELECT * FROM public.family_relationships')).rejects.toThrow('permission denied');
      await expect(db.exec(`INSERT INTO public.family_relationships(member_a,member_b,role_a,role_b) VALUES ('${a}','${b}','Mother','Child')`)).rejects.toThrow('permission denied');
    } finally { await db.exec('RESET ROLE;'); }
  });
  it('unapproved authenticated account cannot insert or promote itself', async () => {
    await expect(asUser(stranger, `INSERT INTO public.family_relationships(member_a,member_b,role_a,role_b) VALUES ('${a}','${b}','Mother','Child')`)).rejects.toThrow('row-level security');
    await expect(asUser(stranger, `INSERT INTO public.user_roles(user_id,role) VALUES ('${stranger}','owner')`)).rejects.toThrow('permission denied');
    expect((await asUser(stranger, 'SELECT public.has_family_access() AS allowed')).rows).toEqual([{ allowed: false }]);
  });
  it('staff stores one relationship and it persists across restart', async () => {
    await asUser(staff, `INSERT INTO public.family_relationships(member_a,member_b,role_a,role_b) VALUES ('${a}','${b}','Mother','Child')`);
    await db.close(); db = new PGlite(directory);
    expect((await asUser(staff, 'SELECT role_a,role_b,version FROM public.family_relationships')).rows).toEqual([{ role_a: 'Mother', role_b: 'Child', version: 1 }]);
  }, 30000);
  it('unapproved account cannot read, edit or remove stored links', async () => {
    expect((await asUser(stranger, 'SELECT * FROM public.family_relationships')).rows).toEqual([]);
    expect((await asUser(stranger, "UPDATE public.family_relationships SET role_a='Father' RETURNING id")).rows).toEqual([]);
    expect((await asUser(stranger, 'DELETE FROM public.family_relationships RETURNING id')).rows).toEqual([]);
  });
  it('SQL prevents self-links, duplicates, reversed duplicates and invalid roles', async () => {
    await expect(asUser(staff, `INSERT INTO public.family_relationships(member_a,member_b,role_a,role_b) VALUES ('${a}','${a}','Spouse','Spouse')`)).rejects.toThrow('family_order');
    await expect(asUser(staff, `INSERT INTO public.family_relationships(member_a,member_b,role_a,role_b) VALUES ('${a}','${b}','Father','Child')`)).rejects.toThrow('family_pair');
    await expect(asUser(staff, `INSERT INTO public.family_relationships(member_a,member_b,role_a,role_b) VALUES ('${b}','${a}','Child','Mother')`)).rejects.toThrow('family_order');
    await expect(asUser(staff, "UPDATE public.family_relationships SET role_b='Spouse'")).rejects.toThrow('family_roles');
  });
  it('requires existing member identities', async () => {
    await expect(asUser(staff, `INSERT INTO public.family_relationships(member_a,member_b,role_a,role_b) VALUES ('${a}','${stranger}','Guardian','Ward')`)).rejects.toThrow('foreign key');
  });
  it('atomically updates versions, rejects stale changes and removes only link', async () => {
    expect((await asUser(staff, "UPDATE public.family_relationships SET role_a='Father' WHERE version=1 RETURNING version")).rows).toEqual([{ version: 2 }]);
    expect((await asUser(staff, "UPDATE public.family_relationships SET role_a='Mother' WHERE version=1 RETURNING id")).rows).toEqual([]);
    expect((await asUser(staff, 'DELETE FROM public.family_relationships WHERE version=1 RETURNING id')).rows).toEqual([]);
    expect((await asUser(staff, 'DELETE FROM public.family_relationships WHERE version=2 RETURNING id')).rows).toHaveLength(1);
    expect((await db.query('SELECT count(*)::int AS count FROM public.members')).rows).toEqual([{ count: 2 }]);
  });
});