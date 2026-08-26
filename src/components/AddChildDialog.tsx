import { useState } from "react";
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
import { addChild } from "@/lib/children.functions";

export function AddChildDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [childName, setChildName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setChildName("");
    setParentName("");
    setParentPhone("");
  }

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
      await addChild({
        data: {
          childName: childName.trim(),
          parentName: parentName.trim(),
          parentPhone: parentPhone.trim(),
        },
      });
      await qc.invalidateQueries({ queryKey: ["children"] });
      toast.success(`${childName.trim()} added to the roster`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not add child", {
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
          <DialogTitle>Add New Child</DialogTitle>
          <DialogDescription>
            Register a child and their parent's WhatsApp contact.
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
              Save child
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
