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
import { addMember } from "@/lib/members.functions";

export function AddMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [memberName, setMemberName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setMemberName("");
    setPhone("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (memberName.trim().length < 2) {
      toast.error("Please enter the member's full name.");
      return;
    }
    if (phone.trim().replace(/[^0-9]/g, "").length < 6) {
      toast.error("Please enter a valid phone number.");
      return;
    }

    setSaving(true);
    try {
      await addMember({
        data: { memberName: memberName.trim(), phone: phone.trim() },
      });
      await qc.invalidateQueries({ queryKey: ["members"] });
      toast.success(`${memberName.trim()} added to the member list`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not add member", {
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
          <DialogTitle>Add New Member</DialogTitle>
          <DialogDescription>
            Register a member and their phone number for attendance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-name">Member's full name</Label>
            <Input
              id="member-name"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="e.g. Tendai Moyo"
              autoComplete="off"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-phone">Phone number</Label>
            <Input
              id="member-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
              Save member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
