import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPaystackSignature } from '../src/lib/paystack.server';

const donorA = '11111111-1111-4111-8111-111111111111';
const donorB = '22222222-2222-4222-8222-222222222222';
const owner = '33333333-3333-4333-8333-333333333333';
const member = '44444444-4444-4444-8444-444444444444';
const migration = readFileSync(new URL('../drizzle/migrations/0001_create_gifts_table.sql', import.meta.url), 'utf8');

async function setHeaders(db: PGlite, token: string) {
  await db.exec(`SET request.headers = '${JSON.stringify({ 'x-giving-device-token': token })}';`);
}

async function clearHeaders(db: PGlite) {
  await db.exec(`SET request.headers = '{}';`);
}

describe('Paystack webhook signature verification', () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'GG-TEST' } });
  const secret = 'sk_test_signature_secret';
  const valid = createHmac('sha512', secret).update(body).digest('hex');

  it('accepts a correct HMAC-SHA512 signature', () => {
    expect(verifyPaystackSignature(body, valid, secret)).toBe(true);
  });
  it('rejects a wrong signature', () => {
    expect(verifyPaystackSignature(body, valid.replace('a', 'b'), secret)).toBe(false);
  });
  it('rejects a signature made with a different secret', () => {
    expect(verifyPaystackSignature(body, valid, 'sk_test_other_secret')).toBe(false);
  });
  it('rejects a tampered body', () => {
    expect(verifyPaystackSignature(body + ' ', valid, secret)).toBe(false);
  });
});

describe('giving storage, verification and access (isolated PostgreSQL)', () => {
  let db: PGlite;
  let directory: string;
  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'giving-test-'));
    db = new PGlite(directory);
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      CREATE TYPE public.app_role AS ENUM ('owner','staff');
      CREATE TABLE public.user_roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        role public.app_role NOT NULL,
        UNIQUE (user_id, role)
      );
      GRANT SELECT ON public.user_roles TO authenticated;
      GRANT ALL ON public.user_roles TO service_role;
      ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
      INSERT INTO auth.users VALUES ('${owner}'),('${member}');`);
    await db.exec(migration);
    await db.exec(`INSERT INTO public.user_roles(user_id,role) VALUES ('${owner}','owner');`);
  }, 30000);
  afterAll(async () => { await db.close(); rmSync(directory, { recursive: true, force: true }); });

  async function insertGift(reference: string, token: string | null, amountCents = 15000) {
    await db.exec(`SET ROLE service_role;`);
    try {
      await db.exec(`INSERT INTO public.gifts(reference,device_token,donor_email,gift_type,amount_cents,currency,status)
        VALUES ('${reference}', ${token ? `'${token}'` : 'NULL'}, 'donor@example.com', 'Tithe', ${amountCents}, 'ZAR', 'Pending')`);
    } finally { await db.exec('RESET ROLE;'); }
  }

  it('anonymous and signed-in donors cannot insert or change gifts', async () => {
    await db.exec('SET ROLE anon;');
    try {
      await expect(db.exec(`INSERT INTO public.gifts(reference,donor_email,gift_type,amount_cents) VALUES ('GG-NO','x@y.com','Tithe',100)`)).rejects.toThrow('permission denied');
      await expect(db.exec(`UPDATE public.gifts SET status='Paid'`)).rejects.toThrow('permission denied');
    } finally { await db.exec('RESET ROLE;'); }
  });

  it('a donor sees only their own device records', async () => {
    await insertGift('GG-A1', donorA);
    await insertGift('GG-A2', donorA);
    await insertGift('GG-B1', donorB);
    await db.exec('SET ROLE anon;');
    try {
      await setHeaders(db, donorA);
      expect((await db.query(`SELECT reference FROM public.gifts ORDER BY reference`)).rows).toEqual([{ reference: 'GG-A1' }, { reference: 'GG-A2' }]);
      await setHeaders(db, donorB);
      expect((await db.query(`SELECT reference FROM public.gifts`)).rows).toEqual([{ reference: 'GG-B1' }]);
    } finally { await clearHeaders(db); await db.exec('RESET ROLE;'); }
  });

  it('without a device header no donor rows are visible', async () => {
    await db.exec('SET ROLE anon;');
    try {
      expect((await db.query(`SELECT count(*)::int AS count FROM public.gifts`)).rows).toEqual([{ count: 0 }]);
    } finally { await db.exec('RESET ROLE;'); }
  });

  it('an unapproved account sees no church-wide gifts and cannot grant itself access', async () => {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${member}';`);
    try {
      expect((await db.query(`SELECT count(*)::int AS count FROM public.gifts`)).rows).toEqual([{ count: 0 }]);
      await expect(db.exec(`INSERT INTO public.user_roles(user_id,role) VALUES ('${member}','owner')`)).rejects.toThrow('permission denied');
    } finally { await db.exec('RESET ROLE;'); }
  });

  it('an approved owner sees church-wide gifts', async () => {
    await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${owner}';`);
    try {
      expect((await db.query(`SELECT count(*)::int AS count FROM public.gifts`)).rows).toEqual([{ count: 3 }]);
    } finally { await db.exec('RESET ROLE;'); }
  });

  it('confirm_gift marks Pending Paid exactly once and is idempotent', async () => {
    await insertGift('GG-C1', donorA);
    await db.exec('SET ROLE service_role;');
    try {
      expect((await db.query(`SELECT public.confirm_gift('GG-C1', 15000, 'ZAR', 'paystack-webhook') AS result`)).rows).toEqual([{ result: 'Paid' }]);
      expect((await db.query(`SELECT public.confirm_gift('GG-C1', 15000, 'ZAR', 'return-verify') AS result`)).rows).toEqual([{ result: 'Already' }]);
      expect((await db.query(`SELECT count(*)::int AS count FROM public.gifts WHERE reference='GG-C1'`)).rows).toEqual([{ count: 1 }]);
      expect((await db.query(`SELECT status FROM public.gifts WHERE reference='GG-C1'`)).rows).toEqual([{ status: 'Paid' }]);
    } finally { await db.exec('RESET ROLE;'); }
  });

  it('confirm_gift refuses an amount or currency mismatch and leaves the gift Pending', async () => {
    await insertGift('GG-C2', donorA, 15000);
    await db.exec('SET ROLE service_role;');
    try {
      expect((await db.query(`SELECT public.confirm_gift('GG-C2', 14999, 'ZAR', 'paystack-webhook') AS result`)).rows).toEqual([{ result: 'Mismatch' }]);
      expect((await db.query(`SELECT public.confirm_gift('GG-C2', 15000, 'USD', 'paystack-webhook') AS result`)).rows).toEqual([{ result: 'Mismatch' }]);
      expect((await db.query(`SELECT status FROM public.gifts WHERE reference='GG-C2'`)).rows).toEqual([{ status: 'Pending' }]);
    } finally { await db.exec('RESET ROLE;'); }
  });

  it('confirm_gift reports an unknown reference without creating anything', async () => {
    await db.exec('SET ROLE service_role;');
    try {
      expect((await db.query(`SELECT public.confirm_gift('GG-NOPE', 100, 'ZAR', 'paystack-webhook') AS result`)).rows).toEqual([{ result: 'Unknown' }]);
      expect((await db.query(`SELECT count(*)::int AS count FROM public.gifts WHERE reference='GG-NOPE'`)).rows).toEqual([{ count: 0 }]);
    } finally { await db.exec('RESET ROLE;'); }
  });

  it('fail_gift marks a Pending gift Failed once and never reverses a Paid gift', async () => {
    await insertGift('GG-F1', donorB);
    await db.exec('SET ROLE service_role;');
    try {
      expect((await db.query(`SELECT public.fail_gift('GG-F1', 'paystack-webhook') AS result`)).rows).toEqual([{ result: 'Failed' }]);
      expect((await db.query(`SELECT public.fail_gift('GG-F1', 'paystack-webhook') AS result`)).rows).toEqual([{ result: 'Already' }]);
      expect((await db.query(`SELECT public.fail_gift('GG-C1', 'paystack-webhook') AS result`)).rows).toEqual([{ result: 'Mismatch' }]);
      expect((await db.query(`SELECT status FROM public.gifts WHERE reference='GG-C1'`)).rows).toEqual([{ status: 'Paid' }]);
    } finally { await db.exec('RESET ROLE;'); }
  });
});
