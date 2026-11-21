import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}

export function Dialog({ title, children, onClose, busy }: DialogProps) {
  const element = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = element.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return (
    <dialog ref={element} className="app-dialog" aria-labelledby={titleId} onCancel={(event) => {
      event.preventDefault();
      if (!busy) onClose();
    }}>
      <div className="app-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="button button-quiet icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}>
          <X size={22} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
