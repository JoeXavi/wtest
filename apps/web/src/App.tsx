import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { ProductPage } from '@/pages/ProductPage';
import { useAppSelector } from '@/store/hooks';
import { Skeleton } from '@/components/ui';

const CheckoutPage = lazy(() =>
  import('@/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })),
);
const SummaryPage = lazy(() =>
  import('@/pages/SummaryPage').then((m) => ({ default: m.SummaryPage })),
);
const ResultPage = lazy(() =>
  import('@/pages/ResultPage').then((m) => ({ default: m.ResultPage })),
);

function RehydrationRouter() {
  const navigate = useNavigate();
  const { step, transaction } = useAppSelector((s) => s.checkout);

  useEffect(() => {
    // Rehydration rules from design-spec §5
    if (transaction?.status === 'PENDING') {
      navigate('/checkout/result', { replace: true });
      return;
    }
    if (
      transaction &&
      (transaction.status === 'APPROVED' ||
        transaction.status === 'DECLINED' ||
        transaction.status === 'ERROR' ||
        transaction.status === 'VOIDED')
    ) {
      navigate('/checkout/result', { replace: true });
      return;
    }
    if (!transaction && (step === 'details' || step === 'summary')) {
      navigate(step === 'details' ? '/checkout' : '/checkout/summary', {
        replace: true,
      });
    }
  }, []); // intentionally once on mount

  return null;
}

function RouteFallback() {
  return (
    <div style={{ padding: 24 }}>
      <Skeleton width="100%" height={120} />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <RehydrationRouter />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<ProductPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/checkout/summary" element={<SummaryPage />} />
          <Route path="/checkout/result" element={<ResultPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
