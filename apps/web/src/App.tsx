import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { LandingPage } from './components/landing/LandingPage';

const WorkbenchApp = lazy(() => import('./WorkbenchApp'));

function isWorkbenchLocation(loc: { pathname: string; search: string }): boolean {
  const path = loc.pathname.toLowerCase();
  if (
    path === '/planner' ||
    path.startsWith('/planner/') ||
    path === '/app' ||
    path.startsWith('/app/')
  ) {
    return true;
  }
  const params = new URLSearchParams(loc.search);
  return params.has('s') || params.has('preset') || params.has('dialog');
}

function WorkbenchLoadingFallback() {
  return (
    <div
      className="min-h-[100dvh] w-full flex items-center justify-center"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-secondary)',
      }}
      role="status"
      aria-live="polite"
    >
      <span className="font-mono-num text-xs tracking-wide">
        Loading LinkSight RF terrain workbench…
      </span>
    </div>
  );
}

export function App() {
  const [routeUrl, setRouteUrl] = useState(() =>
    typeof window === 'undefined'
      ? '/'
      : `${window.location.pathname}${window.location.search}`,
  );

  useEffect(() => {
    const onPopState = () => {
      setRouteUrl(`${window.location.pathname}${window.location.search}`);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(to, window.location.origin);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.pushState({}, '', next);
    setRouteUrl(`${url.pathname}${url.search}`);
    if (!url.hash) {
      window.scrollTo?.(0, 0);
    }
  }, []);

  const parsed = new URL(routeUrl, 'https://rf.andresptr.site');
  const showWorkbench = isWorkbenchLocation({
    pathname: parsed.pathname,
    search: parsed.search,
  });

  if (!showWorkbench) {
    return <LandingPage onNavigate={navigate} />;
  }

  return (
    <Suspense fallback={<WorkbenchLoadingFallback />}>
      <WorkbenchApp onNavigateHome={() => navigate('/')} />
    </Suspense>
  );
}

export default App;
