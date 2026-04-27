import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="modal-v3" role="dialog" aria-modal="true">
      <div className="modal-content-v3">
        <header>
          <h3>{title}</h3>
          <button onClick={onClose} type="button" aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body-v3">{children}</div>
      </div>
    </div>
  );
}

