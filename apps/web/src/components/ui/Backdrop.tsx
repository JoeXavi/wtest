import { useState, type ReactNode } from 'react';
import styles from './Backdrop.module.css';

export interface BackdropProps {
  stripTitle: string;
  stripMeta?: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export function Backdrop({
  stripTitle,
  stripMeta,
  children,
  defaultExpanded = true,
  className,
}: BackdropProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={[styles.root, className ?? ''].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.strip}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={styles.stripTitle}>{stripTitle}</div>
        {stripMeta ? <div className={styles.stripMeta}>{stripMeta}</div> : null}
      </button>
      <div
        className={[styles.back, expanded ? styles.backExpanded : '']
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
