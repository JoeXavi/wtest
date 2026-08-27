import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { copy } from '@/copy';
import {
  Button,
  ErrorBanner,
  Pill,
  Skeleton,
  Stepper,
} from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchProducts,
  clearProductsError,
} from '@/store/slices/productsSlice';
import {
  openDetails,
  selectHours,
  setProductId,
} from '@/store/slices/checkoutSlice';
import styles from './ProductPage.module.css';

export function ProductPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { selected, status, error } = useAppSelector((s) => s.products);
  const hours = useAppSelector((s) => s.checkout.hours);
  const stockBanner = useAppSelector((s) => s.checkout.ui.error);

  useEffect(() => {
    void dispatch(fetchProducts());
  }, [dispatch]);

  useEffect(() => {
    if (selected) {
      dispatch(setProductId(selected.productId));
      const max = Math.min(selected.available, 96);
      if (hours > max && max >= 1) {
        dispatch(selectHours(max));
      }
    }
  }, [selected, dispatch, hours]);

  const available = selected?.available ?? 0;
  const maxHours = Math.min(available, 96);
  const soldOut = available <= 0;

  const onPay = () => {
    if (!selected || soldOut) return;
    dispatch(openDetails());
    navigate('/checkout');
  };

  return (
    <main className={styles.page}>
      <div className={styles.brand}>{copy.brand}</div>

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => {
            dispatch(clearProductsError());
            void dispatch(fetchProducts());
          }}
        />
      ) : null}

      {stockBanner?.startsWith('Only') ? (
        <ErrorBanner message={stockBanner} />
      ) : null}

      <div className={styles.layout}>
        <div className={styles.hero}>
          {status === 'loading' && !selected ? (
            <Skeleton width="100%" height={280} aria-label="Loading hero" />
          ) : (
            <img
              className={styles.heroImg}
              src="/hero.svg"
              alt={selected?.image.alt ?? 'Desk with laptop and code'}
              width={selected?.image.width ?? 1120}
              height={selected?.image.height ?? 840}
              fetchPriority="high"
            />
          )}
        </div>

        <div className={styles.purchase}>
          {status === 'loading' && !selected ? (
            <Skeleton width="60%" height={28} />
          ) : (
            <Pill tone="success">{copy.hoursAvailable(available)}</Pill>
          )}

          <h1 className={styles.title}>
            {selected?.name ?? copy.productName}
          </h1>

          {status === 'loading' && !selected ? (
            <Skeleton width={160} height={36} />
          ) : (
            <>
              <p className={styles.price}>{copy.usdPrice}</p>
              <p className={styles.helper}>{copy.copHelper}</p>
            </>
          )}

          <p className={styles.description}>
            {selected?.description ?? copy.productDescription}
          </p>

          <div className={styles.hoursRow}>
            <span className={styles.hoursLabel}>{copy.hoursLabel}</span>
            <Stepper
              value={Math.min(hours, Math.max(1, maxHours || 1))}
              min={1}
              max={maxHours || 1}
              onChange={(v) => dispatch(selectHours(v))}
            />
          </div>

          {status === 'loading' && !selected ? (
            <Skeleton width="100%" height={44} aria-label="Loading CTA" />
          ) : soldOut ? (
            <Button fullWidth disabled>
              {copy.soldOut}
            </Button>
          ) : (
            <Button fullWidth onClick={onPay}>
              {copy.payCta}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
