import { X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';

interface PlayerDialogProps {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
}

export function PlayerDialog({ title, eyebrow, children, onClose, closeDisabled }: PlayerDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;

    element.showModal();
    return () => {
      element.close();
    };
  }, []);

  return (
    <dialog
      className="fit-player-dialog"
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
    >
      <div className="fit-player-dialog__heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          type="button"
          className="fit-player-icon-button"
          aria-label="Close"
          disabled={closeDisabled}
          onClick={onClose}
        >
          <X size={21} aria-hidden="true" />
        </button>
      </div>
      <div className="fit-player-dialog__body">{children}</div>
    </dialog>
  );
}
