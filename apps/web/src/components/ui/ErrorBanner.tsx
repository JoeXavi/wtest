import styles from './ErrorBanner.module.css';

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = 'Retry',
  className,
}: ErrorBannerProps) {
  return (
    <div
      className={[styles.banner, className ?? ''].filter(Boolean).join(' ')}
      role="alert"
    >
      <p className={styles.message}>{message}</p>
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
