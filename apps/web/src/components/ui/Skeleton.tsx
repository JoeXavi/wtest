import styles from './Skeleton.module.css';

export interface SkeletonProps {
  width: number | string;
  height: number | string;
  className?: string;
  'aria-label'?: string;
}

export function Skeleton({
  width,
  height,
  className,
  'aria-label': ariaLabel = 'Loading',
}: SkeletonProps) {
  return (
    <span
      className={[styles.skeleton, className ?? ''].filter(Boolean).join(' ')}
      style={{ width, height }}
      aria-busy="true"
      aria-label={ariaLabel}
      role="status"
    />
  );
}
