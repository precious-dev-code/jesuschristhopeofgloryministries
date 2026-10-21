import { z } from "zod";

export const familyRoles = ["Mother", "Father", "Child", "Sister", "Brother", "Sibling", "Grandmother", "Grandfather", "Grandchild", "Spouse", "Guardian", "Ward", "Aunt", "Uncle", "Niece", "Nephew"] as const;
export type FamilyRole = typeof familyRoles[number];
export const reciprocals: Record<FamilyRole, readonly FamilyRole[]> = {
  Mother: ["Child"], Father: ["Child"], Child: ["Mother", "Father"],
  Sister: ["Sister", "Brother", "Sibling"], Brother: ["Sister", "Brother", "Sibling"], Sibling: ["Sister", "Brother", "Sibling"],
  Grandmother: ["Grandchild"], Grandfather: ["Grandchild"], Grandchild: ["Grandmother", "Grandfather"],
  Spouse: ["Spouse"], Guardian: ["Ward"], Ward: ["Guardian"],
  Aunt: ["Niece", "Nephew"], Uncle: ["Niece", "Nephew"], Niece: ["Aunt", "Uncle"], Nephew: ["Aunt", "Uncle"],
};
export const relationshipInput = z.object({
  id: z.string().uuid().optional(), version: z.number().int().positive().optional(),
  personId: z.string().uuid(), relativeId: z.string().uuid(),
  role: z.enum(familyRoles), reciprocalRole: z.enum(familyRoles),
}).superRefine((value, ctx) => {
  if (value.personId === value.relativeId) ctx.addIssue({ code: "custom", message: "A person cannot be their own relative." });
  if (!reciprocals[value.role].includes(value.reciprocalRole)) ctx.addIssue({ code: "custom", message: "Choose a compatible reciprocal role." });
  if (Boolean(value.id) !== Boolean(value.version)) ctx.addIssue({ code: "custom", message: "Reload this relationship before editing." });
});
export type RelationshipInput = z.infer<typeof relationshipInput>;
export type FamilyLink = { id: string; member_a: string; member_b: string; role_a: FamilyRole; role_b: FamilyRole; version: number };
export function canonicalRelationship(input: RelationshipInput) {
  const value = relationshipInput.parse(input);
  return value.personId < value.relativeId
    ? { member_a: value.personId, member_b: value.relativeId, role_a: value.role, role_b: value.reciprocalRole }
    : { member_a: value.relativeId, member_b: value.personId, role_a: value.reciprocalRole, role_b: value.role };
}
export function relativeView(link: FamilyLink, personId: string) {
  if (link.member_a === personId) return { relativeId: link.member_b, role: link.role_a, reciprocalRole: link.role_b };
  if (link.member_b === personId) return { relativeId: link.member_a, role: link.role_b, reciprocalRole: link.role_a };
  return null;
}
export function assertStaffAccess(allowed: boolean | null | undefined) {
  if (allowed !== true) throw new Error("Staff access required. Ask the church owner to approve your account.");
}
export function familyError(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "These members already have a relationship. Edit the existing link instead.";
  if (error.code === "23503") return "One of these members no longer exists. Refresh the member list.";
  if (error.code === "23514") return "Choose two different members and compatible reciprocal roles.";
  if (error.code === "42501") return "Staff access required. Ask the church owner to approve your account.";
  return "Could not save the relationship. Please refresh and try again.";
}