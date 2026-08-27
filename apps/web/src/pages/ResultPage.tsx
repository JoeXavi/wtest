import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '@/copy';
import { Button, Money, Pill } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  backToStore,
  clearCheckoutError,
  pollTransaction,
  retryWithNewCard,
} from '@/store/slices/checkoutSlice';
import { fetchProducts, refreshStock } from '@/store/slices/productsSlice';
import {
  backoffDelayMs,
  isRetryableRejectPayload,
  MAX_RETRIES,
  rejectRetryAfterMs,
} from '@/services/retryPolicy';
import styles from './ResultPage.module.css';

export function ResultPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const checkout = useAppSelector((s) => s.checkout);
  const { transaction, card, hours, delivery, customer, step, productId, ui } =
    checkout;
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startChainRef = useRef<(() => void) | null>(null);
  const [pollExhausted, setPollExhausted] = useState(false);

  useEffect(() => {
    if (step !== 'result' && !transaction) {
      navigate('/', { replace: true });
    }
  }, [step, transaction, navigate]);

  useEffect(() => {
    if (!transaction || transaction.status !== 'PENDING') {
      return;
    }

    let cancelled = false;

    const scheduleRetry = (payload?: unknown) => {
      if (cancelled || attemptsRef.current >= MAX_RETRIES) {
        setPollExhausted(true);
        return;
      }
      const delay = backoffDelayMs(
        attemptsRef.current,
        rejectRetryAfterMs(payload),
      );
      attemptsRef.current += 1;
      timerRef.current = setTimeout(() => void tick(), delay);
    };

    const tick = async () => {
      if (cancelled) return;

      const result = await dispatch(pollTransaction(transaction.reference));
      if (cancelled) return;

      if (pollTransaction.fulfilled.match(result)) {
        if (result.payload.status !== 'PENDING') {
          setPollExhausted(false);
          return;
        }
        scheduleRetry();
        return;
      }

      if (pollTransaction.rejected.match(result)) {
        const payload = result.payload as
          | { message?: string; status?: number }
          | string
          | undefined;

        if (
          payload &&
          typeof payload === 'object' &&
          payload.status === 404
        ) {
          dispatch(backToStore());
          navigate('/', { replace: true });
          return;
        }

        if (!isRetryableRejectPayload(payload)) {
          return;
        }

        scheduleRetry(payload);
      }
    };

    const startChain = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      attemptsRef.current = 0;
      setPollExhausted(false);
      dispatch(clearCheckoutError());
      void tick();
    };

    startChainRef.current = startChain;
    startChain();

    return () => {
      cancelled = true;
      startChainRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [transaction?.reference, transaction?.status, dispatch, navigate]);

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

  const onCheckAgain = useCallback(() => {
    startChainRef.current?.();
  }, []);

  return (
    <main className={styles.page}>
      <div
        className={styles.card}
        data-testid="result-status"
        aria-live="polite"
      >
        {status === 'PENDING' ? (
          <>
            {!pollExhausted ? (
              <div className={`${styles.mark} ${styles.markPending}`}>
                <span className={styles.spinner} aria-hidden="true" />
              </div>
            ) : null}
            <h1 className={styles.title}>
              {pollExhausted ? copy.pendingExhausted : copy.pendingTitle}
            </h1>
            {!pollExhausted ? (
              <p className={styles.body}>{copy.pendingHint}</p>
            ) : null}
            {transaction ? (
              <p className={styles.body}>
                {copy.reference}: {transaction.reference}
              </p>
            ) : null}
            {ui.error ? (
              <p className={styles.body} role="alert">{ui.error}</p>
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
