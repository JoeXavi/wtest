import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '@/copy';
import {
  Backdrop,
  Button,
  ErrorBanner,
  Money,
  formatMoneyFromCents,
} from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  createCheckoutTransaction,
  payCheckout,
  setAcceptance,
  clearCheckoutError,
} from '@/store/slices/checkoutSlice';
import styles from './SummaryPage.module.css';

export function SummaryPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const checkout = useAppSelector((s) => s.checkout);
  const product = useAppSelector((s) => s.products.selected);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const payKeyRef = useRef(`pay-${crypto.randomUUID()}`);
  const payingRef = useRef(false);
  const termsId = useId();
  const dataId = useId();

  const {
    hours,
    card,
    delivery,
    customer,
    transaction,
    pspSession,
    acceptance,
    ui,
    step,
  } = checkout;

  useEffect(() => {
    if (step === 'details') {
      navigate('/checkout', { replace: true });
      return;
    }
    if (step === 'result') {
      navigate('/checkout/result', { replace: true });
      return;
    }
    if (step === 'product' || !card || !customer || !delivery) {
      navigate('/', { replace: true });
    }
  }, [step, card, customer, delivery, navigate]);

  useEffect(() => {
    if (!transaction && card && customer && delivery && !ui.submitting) {
      void dispatch(createCheckoutTransaction()).then((result) => {
        if (createCheckoutTransaction.rejected.match(result)) {
          const payload = result.payload as
            | { status?: number; body?: { available?: number; code?: string }; message?: string }
            | undefined;
          if (payload?.status === 409) {
            const available = payload.body?.available ?? 0;
            navigate('/', { replace: true });
            // stock banner handled via error message on product if needed
            void available;
          }
        }
      });
    }
  }, [transaction, card, customer, delivery, ui.submitting, dispatch, navigate]);

  const onPay = async () => {
    if (payingRef.current || ui.submitting) return;
    if (!acceptance.termsAccepted || !acceptance.dataAccepted) {
      setAcceptError(copy.acceptBoth);
      return;
    }
    setAcceptError(null);
    payingRef.current = true;
    try {
      const result = await dispatch(payCheckout(payKeyRef.current));
      if (payCheckout.fulfilled.match(result)) {
        navigate('/checkout/result');
      } else {
        payingRef.current = false;
      }
    } catch {
      payingRef.current = false;
    }
  };

  const brandLabel =
    card?.brand === 'visa'
      ? 'Visa'
      : card?.brand === 'mastercard'
        ? 'Mastercard'
        : 'Card';

  const usdApprox =
    transaction && product
      ? ((transaction.breakdown.totalCents / 100) / 2500).toFixed(2)
      : null;

  return (
    <main className={styles.page}>
      <Backdrop
        stripTitle={`${copy.productName} × ${hours}h`}
        stripMeta={
          card ? `${brandLabel} •••• ${card.last4}` : undefined
        }
      >
        {ui.error ? (
          <ErrorBanner
            message={ui.error}
            onRetry={() => {
              dispatch(clearCheckoutError());
              void dispatch(createCheckoutTransaction());
            }}
          />
        ) : null}

        {!transaction ? (
          <p className={styles.loading} aria-live="polite">
            Loading summary…
          </p>
        ) : (
          <>
            <div className={styles.breakdown}>
              <div className={styles.row}>
                <span>{copy.hoursSubtotal}</span>
                <Money cents={transaction.breakdown.itemCents} />
              </div>
              <div className={styles.row}>
                <span>{copy.baseFee}</span>
                <Money cents={transaction.breakdown.baseFeeCents} />
              </div>
              <div className={styles.row}>
                <span>{copy.deliveryFee}</span>
                <Money cents={transaction.breakdown.deliveryFeeCents} />
              </div>
              <div className={styles.hairline} />
              <div className={`${styles.row} ${styles.total}`} data-testid="summary-total">
                <span>{copy.total}</span>
                <Money cents={transaction.breakdown.totalCents} />
              </div>
              {usdApprox ? (
                <p className={styles.muted}>{copy.usdEquivalent(usdApprox)}</p>
              ) : null}
            </div>

            {delivery && customer ? (
              <div className={styles.address}>
                <strong>{customer.fullName}</strong>
                <span>{delivery.addressLine1}</span>
                {delivery.addressLine2 ? <span>{delivery.addressLine2}</span> : null}
                <span>
                  {delivery.city}, {delivery.region}
                </span>
                <span>{customer.email}</span>
                <span>{customer.phone}</span>
              </div>
            ) : null}

            <div className={styles.policies}>
              <label className={styles.check} htmlFor={termsId}>
                <input
                  id={termsId}
                  type="checkbox"
                  checked={acceptance.termsAccepted}
                  onChange={(e) =>
                    dispatch(setAcceptance({ termsAccepted: e.target.checked }))
                  }
                />
                <span>
                  {copy.acceptTerms}
                  {pspSession ? (
                    <>
                      {' '}
                      <a
                        href={pspSession.policyLinks.endUserPolicy}
                        target="_blank"
                        rel="noreferrer"
                      >
                        (policy)
                      </a>
                    </>
                  ) : null}
                </span>
              </label>
              <label className={styles.check} htmlFor={dataId}>
                <input
                  id={dataId}
                  type="checkbox"
                  checked={acceptance.dataAccepted}
                  onChange={(e) =>
                    dispatch(setAcceptance({ dataAccepted: e.target.checked }))
                  }
                />
                <span>
                  {copy.acceptData}
                  {pspSession ? (
                    <>
                      {' '}
                      <a
                        href={pspSession.policyLinks.personalDataAuth}
                        target="_blank"
                        rel="noreferrer"
                      >
                        (policy)
                      </a>
                    </>
                  ) : null}
                </span>
              </label>
              {acceptError ? (
                <p role="alert" className={styles.muted} style={{ color: 'var(--color-danger)' }}>
                  {acceptError}
                </p>
              ) : null}
            </div>

            <div className={styles.actions}>
              <Button
                fullWidth
                loading={ui.submitting}
                onClick={() => void onPay()}
              >
                {copy.payTotal(formatMoneyFromCents(transaction.breakdown.totalCents))}
              </Button>
            </div>
          </>
        )}
      </Backdrop>
    </main>
  );
}
