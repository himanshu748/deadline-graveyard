// Modal dialog on the native <dialog> element (accessible-list-view R2.4, R2.5). showModal() makes
// the rest of the page inert and moves focus inside (MDN). Escape closes it; the caller restores
// focus to the opener. If showModal is missing, a small Tab trap keeps focus inside.
import type { ComponentChildren, TargetedKeyboardEvent } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  titleId: string;
  onClose: () => void;
  children: ComponentChildren;
  /** Extra class next to `panel`, for example `intro` for the first-visit panel. */
  className?: string;
}

export function Modal({ titleId, onClose, children, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const native = useRef(true);

  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (typeof d.showModal === 'function') {
      d.showModal();
    } else {
      native.current = false;
      d.setAttribute('open', '');
      d.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
    return () => {
      if (typeof d.close === 'function' && d.open) d.close();
    };
  }, []);

  const onKeyDown = (e: TargetedKeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || native.current) return;
    const nodes = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      ref={ref}
      class={className ? `panel ${className}` : 'panel'}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
