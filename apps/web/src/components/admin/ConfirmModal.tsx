// Generic confirmation dialog: danger-styled confirm + cancel.
import type { ReactNode } from "react";
import { Button, Modal } from "@/components/ui";

export function ConfirmModal({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: ReactNode;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      {children}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Modal>
  );
}
