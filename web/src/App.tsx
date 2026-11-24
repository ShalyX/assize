// SPDX-License-Identifier: Apache-2.0
// Assize — Root Application Shell & Bookmarkable Hash Router

import { useCallback, useEffect, useState } from 'react';
import { SplitSealLogo } from './components/SplitSealLogo';
import { AssizeBrowserSession, Phase } from './lib/assizeEngine';
import { OverviewPage, type AppRoute } from './pages/OverviewPage';
import { TenderRoomPage } from './pages/TenderRoomPage';
import { VerifyPage } from './pages/VerifyPage';
import { AwardCertificatePage } from './pages/AwardCertificatePage';

interface ParsedLocation {
  route: AppRoute;
  verifyTenderIdx: number;
}

function parseLocationState(): ParsedLocation {
  const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
  if (rawHash) {
    const [routePart, queryPart] = rawHash.split('?');
    const params = new URLSearchParams(queryPart ?? '');
    const tenderParam = (params.get('tender') ?? '').toUpperCase();
    const verifyTenderIdx = tenderParam === 'B' || tenderParam === '1' ? 1 : 0;

    if (routePart === 'tender') return { route: 'tender', verifyTenderIdx };
    if (routePart === 'verify') return { route: 'verify', verifyTenderIdx };
    if (routePart === 'certificate' || routePart === 'verify/award' || routePart === 'award') {
      return { route: 'certificate', verifyTenderIdx };
    }
    return { route: 'overview', verifyTenderIdx };
  }

  const pathname = window.location.pathname.toLowerCase();
  if (pathname.startsWith('/verify/award')) return { route: 'certificate', verifyTenderIdx: 0 };
  if (pathname.startsWith('/verify')) return { route: 'verify', verifyTenderIdx: 0 };
  if (pathname.startsWith('/tender')) return { route: 'tender', verifyTenderIdx: 0 };
  return { route: 'overview', verifyTenderIdx: 0 };
}

function buildHash(route: AppRoute, verifyTenderIdx?: number): string {
  if (route === 'verify' && verifyTenderIdx === 1) {
    return '#verify?tender=B';
  }
  if (route === 'verify' && verifyTenderIdx === 0) {
    return '#verify';
  }
  return `#${route}`;
}

export function App() {
  const initial = parseLocationState();
  const [route, setRoute] = useState<AppRoute>(initial.route);
  const [verifyTenderIdx, setVerifyTenderIdx] = useState<number>(initial.verifyTenderIdx);
  const [session, setSession] = useState<AssizeBrowserSession | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const navigate = useCallback((nextRoute: AppRoute, tenderIdx?: number) => {
    setRoute(nextRoute);
    if (typeof tenderIdx === 'number') {
      setVerifyTenderIdx(tenderIdx);
    }
    const targetHash = buildHash(nextRoute, tenderIdx);
    if (window.location.hash !== targetHash) {
      window.history.pushState(null, '', targetHash);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    // Ensure initial load reflects a clean bookmarkable hash if none was set
    if (!window.location.hash) {
      window.history.replaceState(null, '', buildHash(initial.route, initial.verifyTenderIdx));
    }
    const onHashChange = () => {
      const parsed = parseLocationState();
      setRoute(parsed.route);
      setVerifyTenderIdx(parsed.verifyTenderIdx);
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initSession = async () => {
    try {
      setInitError(null);
      const s = await AssizeBrowserSession.createDefaultFixture();
      setSession(s);
      setTick((t) => t + 1);
    } catch (err) {
      setInitError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void initSession();
  }, []);

  const snap = session ? session.getSnapshot() : null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="site-header">
        <div className="header-inner">
          <div className="brand-cluster">
            <button
              type="button"
              className="brand-link"
              onClick={() => navigate('overview')}
              aria-label="Assize — Municipal Procurement Registry Home"
            >
              <SplitSealLogo size={28} />
              <span className="brand-text-group">
                <span className="brand-wordmark">Assize</span>
                <span className="brand-sub">Sealed-Bid Procurement Registry</span>
              </span>
            </button>

            <span className="brand-divider" aria-hidden="true" />

            <div className="docket-meta">
              <span className="network-pill">
                <span className="network-dot" aria-hidden="true" />
                Midnight Ledger 9 · Compact 0.36.1
              </span>
              {snap && (
                <span
                  className={`tag ${
                    snap.phase === Phase.CONTESTED
                      ? 'tag-contested'
                      : snap.phase === Phase.FINALIZED || snap.phase === Phase.AWARDED
                        ? 'tag-verified'
                        : 'tag-neutral'
                  }`}
                >
                  Docket {session?.tenderCode}: {Phase[snap.phase]}
                </span>
              )}
            </div>
          </div>

          <nav className="nav-links" aria-label="Primary navigation">
            <button
              type="button"
              className={`nav-btn ${route === 'overview' ? 'active' : ''}`}
              aria-current={route === 'overview' ? 'page' : undefined}
              onClick={() => navigate('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              className={`nav-btn ${route === 'tender' ? 'active' : ''}`}
              aria-current={route === 'tender' ? 'page' : undefined}
              onClick={() => navigate('tender')}
            >
              Tender Room
            </button>
            <button
              type="button"
              className={`nav-btn ${route === 'verify' ? 'active' : ''}`}
              aria-current={route === 'verify' ? 'page' : undefined}
              onClick={() => navigate('verify')}
            >
              Live On-Chain /verify
              <span className="nav-count">26 ZK</span>
            </button>
            <button
              type="button"
              className={`nav-btn ${route === 'certificate' ? 'active' : ''}`}
              aria-current={route === 'certificate' ? 'page' : undefined}
              onClick={() => navigate('certificate')}
            >
              Award Certificate
            </button>
          </nav>
        </div>
      </header>

      <main className="page-wrap" style={{ flex: 1, width: '100%' }}>
        {initError && (
          <div className="alert-box alert-contested" style={{ marginBottom: 18 }} role="alert">
            <div>
              <strong>Compact Runtime Initialization Error:</strong>{' '}
              <span className="mono">{initError}</span>
            </div>
          </div>
        )}

        {route === 'overview' && <OverviewPage onNavigate={navigate} />}
        {route === 'tender' && (
          <TenderRoomPage
            session={session}
            onSessionUpdate={() => setTick((t) => t + 1)}
            onReset={initSession}
            onNavigate={navigate}
          />
        )}
        {route === 'verify' && (
          <VerifyPage
            selectedIdx={verifyTenderIdx}
            onSelectTender={(idx) => navigate('verify', idx)}
          />
        )}
        {route === 'certificate' && (
          <AwardCertificatePage session={session} onNavigate={navigate} />
        )}
      </main>

      <footer className="site-footer no-print">
        <div className="footer-inner">
          <div>
            <strong>Assize</strong> · Verifiable Sealed-Bid Public-Works Procurement on Midnight
            (Apache-2.0 · <span className="mono">compact 0.36.1</span> ·{' '}
            <span className="mono">proof-server:9.0.2</span>)
          </div>
          <div className="mono" style={{ fontSize: 11 }}>
            CLI Verification: <code>npm run verify:onchain</code> · <code>npm run test:contracts</code> (104/104)
          </div>
        </div>
      </footer>
    </div>
  );
}
