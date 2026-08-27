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
import { rehydrationPath } from '@/store/rehydration';
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
    const path = rehydrationPath(step, transaction);
    if (path) {
      navigate(path, { replace: true });
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
