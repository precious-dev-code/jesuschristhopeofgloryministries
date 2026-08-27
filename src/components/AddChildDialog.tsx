import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addChild, updateChild } from "@/lib/children.functions";

export type EditableChild = {
  id: string;
  child_name: string;
  parent_name: string;
  parent_phone: string;
};

export function AddChildDialog({
  open,
  onOpenChange,
  child = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this child instead of creating a new one. */
  child?: EditableChild | null;
}) {
  const qc = useQueryClient();
  const [childName, setChildName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(child);

  useEffect(() => {
    if (!open) return;
    setChildName(child?.child_name ?? "");
    setParentName(child?.parent_name ?? "");
    setParentPhone(child?.parent_phone ?? "");
  }, [open, child]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (childName.trim().length < 2 || parentName.trim().length < 2) {
      toast.error("Please enter both the child's and parent's full name.");
      return;
    }
    if (parentPhone.trim().replace(/[^0-9]/g, "").length < 6) {
      toast.error("Please enter a valid WhatsApp number.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        childName: childName.trim(),
        parentName: parentName.trim(),
        parentPhone: parentPhone.trim(),
      };

      if (child) {
        await updateChild({ data: { childId: child.id, ...payload } });
        toast.success(`${payload.childName} updated`);
      } else {
        await addChild({ data: payload });
        toast.success(`${payload.childName} added to the roster`);
      }

      await qc.invalidateQueries({ queryKey: ["children"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(isEdit ? "Could not update child" : "Could not add child", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Child" : "Add New Child"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Correct the child's or parent's details."
              : "Register a child and their parent's WhatsApp contact."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="child-name">Child's full name</Label>
            <Input
              id="child-name"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="e.g. Amara Dube"
              autoComplete="off"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent-name">Parent's full name</Label>
            <Input
              id="parent-name"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="e.g. Grace Dube"
              autoComplete="off"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent-phone">Parent's WhatsApp number</Label>
            <Input
              id="parent-phone"
              type="tel"
              inputMode="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="e.g. +27 82 123 4567"
              autoComplete="off"
              className="h-11"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11 font-semibold" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Save child"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
