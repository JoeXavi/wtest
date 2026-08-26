import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '@/copy';
import { Button, Money, Pill } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  backToStore,
  pollTransaction,
  retryWithNewCard,
} from '@/store/slices/checkoutSlice';
import { fetchProducts, refreshStock } from '@/store/slices/productsSlice';
import styles from './ResultPage.module.css';

const MAX_POLL_MS = 5 * 60 * 1000;
const BACKOFF = [1000, 2000, 3000];

export function ResultPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const checkout = useAppSelector((s) => s.checkout);
  const { transaction, card, hours, delivery, customer, step, productId } =
    checkout;
  const attemptRef = useRef(0);
  const startedRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step !== 'result' && !transaction) {
      navigate('/', { replace: true });
    }
  }, [step, transaction, navigate]);

  useEffect(() => {
    if (!transaction || transaction.status !== 'PENDING') return;

    let cancelled = false;
    startedRef.current = Date.now();
    attemptRef.current = 0;

    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - startedRef.current > MAX_POLL_MS) return;

      const result = await dispatch(pollTransaction(transaction.reference));
      if (cancelled) return;

      if (pollTransaction.fulfilled.match(result)) {
        if (result.payload.status === 'PENDING') {
          const delay =
            BACKOFF[Math.min(attemptRef.current, BACKOFF.length - 1)]!;
          attemptRef.current += 1;
          timerRef.current = setTimeout(() => void tick(), delay);
        }
      } else {
        const delay =
          BACKOFF[Math.min(attemptRef.current, BACKOFF.length - 1)]!;
        attemptRef.current += 1;
        timerRef.current = setTimeout(() => void tick(), delay);
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [transaction?.reference, transaction?.status, dispatch]);

  const status = transaction?.status ?? 'PENDING';
  const brandLabel =
    card?.brand === 'visa'
      ? 'Visa'
      : card?.brand === 'mastercard'
        ? 'Mastercard'
        : 'Card';

  const onBackToStore = async () => {
    const pid = productId;
    dispatch(backToStore());
    if (pid) {
      await dispatch(refreshStock(pid));
    }
    await dispatch(fetchProducts());
    navigate('/');
  };

  const onRetryCard = () => {
    dispatch(retryWithNewCard());
    navigate('/checkout');
  };

  const onCheckAgain = () => {
    if (!transaction) return;
    attemptRef.current = 0;
    startedRef.current = Date.now();
    void dispatch(pollTransaction(transaction.reference));
  };

  return (
    <main className={styles.page}>
      <div
        className={styles.card}
        data-testid="result-status"
        aria-live="polite"
      >
        {status === 'PENDING' ? (
          <>
            <div className={`${styles.mark} ${styles.markPending}`}>
              <span className={styles.spinner} aria-hidden="true" />
            </div>
            <h1 className={styles.title}>{copy.pendingTitle}</h1>
            <p className={styles.body}>{copy.pendingHint}</p>
            {transaction ? (
              <p className={styles.body}>
                {copy.reference}: {transaction.reference}
              </p>
            ) : null}
            <Button variant="ghost" onClick={onCheckAgain}>
              {copy.checkAgain}
            </Button>
          </>
        ) : null}

        {status === 'APPROVED' ? (
          <>
            <div className={`${styles.mark} ${styles.markSuccess}`} aria-hidden="true">
              ✓
            </div>
            <h1 className={styles.title}>{copy.approvedTitle}</h1>
            <p className={styles.body}>{copy.approvedBody(hours)}</p>
            <Receipt
              reference={transaction!.reference}
              brandLabel={brandLabel}
              last4={card?.last4 ?? '••••'}
              hours={hours}
              totalCents={transaction!.breakdown.totalCents}
              status="APPROVED"
              address={
                delivery
                  ? `${delivery.addressLine1}, ${delivery.city}`
                  : undefined
              }
              name={customer?.fullName}
            />
          </>
        ) : null}

        {status === 'DECLINED' ||
        status === 'ERROR' ||
        status === 'VOIDED' ? (
          <>
            <div className={`${styles.mark} ${styles.markDanger}`} aria-hidden="true">
              !
            </div>
            <h1 className={styles.title}>{copy.declinedTitle}</h1>
            <p className={styles.body}>{copy.declinedBody}</p>
            {transaction?.statusMessage ? (
              <p className={styles.body}>{transaction.statusMessage}</p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className={styles.actions}>
        {status === 'APPROVED' ? (
          <Button variant="ghost" fullWidth onClick={() => void onBackToStore()}>
            {copy.backToStore}
          </Button>
        ) : null}
        {status === 'DECLINED' ||
        status === 'ERROR' ||
        status === 'VOIDED' ? (
          <>
            <Button fullWidth onClick={onRetryCard}>
              {copy.tryAnotherCard}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => void onBackToStore()}>
              {copy.backToStore}
            </Button>
          </>
        ) : null}
      </div>
    </main>
  );
}

function Receipt({
  reference,
  brandLabel,
  last4,
  hours,
  totalCents,
  status,
  address,
  name,
}: {
  reference: string;
  brandLabel: string;
  last4: string;
  hours: number;
  totalCents: number;
  status: string;
  address?: string;
  name?: string;
}) {
  return (
    <div className={styles.receipt}>
      <div className={styles.receiptRow}>
        <span>{copy.reference}</span>
        <span>{reference}</span>
      </div>
      <div className={styles.receiptRow}>
        <span>Card</span>
        <span>
          {brandLabel} •••• {last4}
        </span>
      </div>
      <div className={styles.receiptRow}>
        <span>{copy.hoursLabel}</span>
        <span>{hours}</span>
      </div>
      <div className={styles.receiptRow}>
        <span>{copy.total}</span>
        <Money cents={totalCents} />
      </div>
      <div className={styles.receiptRow}>
        <span>Status</span>
        <Pill tone="success">{status}</Pill>
      </div>
      {name ? (
        <div className={styles.receiptRow}>
          <span>Name</span>
          <span>{name}</span>
        </div>
      ) : null}
      {address ? (
        <div className={styles.receiptRow}>
          <span>Address</span>
          <span>{address}</span>
        </div>
      ) : null}
    </div>
  );
}
