// SPDX-License-Identifier: Apache-2.0
// Assize — Root Application Shell

import { useEffect, useState } from 'react';
import { SplitSealLogo } from './components/SplitSealLogo';
import { AssizeBrowserSession } from './lib/assizeEngine';
import { OverviewPage, type AppRoute } from './pages/OverviewPage';
import { TenderRoomPage } from './pages/TenderRoomPage';
import { VerifyPage } from './pages/VerifyPage';
import { AwardCertificatePage } from './pages/AwardCertificatePage';

export function App() {
  const [route, setRoute] = useState<AppRoute>('overview');
  const [session, setSession] = useState<AssizeBrowserSession | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [, setTick] = useState(0);

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

  return (
    <div>
      <header className="site-header">
        <div className="header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="brand-link" onClick={() => setRoute('overview')}>
              <SplitSealLogo size={24} />
              <span className="brand-wordmark">Assize</span>
            </button>
            <span className="network-pill">Midnight Preprod · Compact 0.36.1</span>
          </div>

          <nav className="nav-links" aria-label="Primary navigation">
            <button
              className={`nav-btn ${route === 'overview' ? 'active' : ''}`}
              onClick={() => setRoute('overview')}
            >
              Overview
            </button>
            <button
              className={`nav-btn ${route === 'tender' ? 'active' : ''}`}
              onClick={() => setRoute('tender')}
            >
              Tender Room
            </button>
            <button
              className={`nav-btn ${route === 'verify' ? 'active' : ''}`}
              onClick={() => setRoute('verify')}
            >
              Live Preprod /verify
            </button>
            <button
              className={`nav-btn ${route === 'certificate' ? 'active' : ''}`}
              onClick={() => setRoute('certificate')}
            >
              Award Certificate
            </button>
          </nav>
        </div>
      </header>

      <main className="page-wrap">
        {initError && (
          <div className="alert-box alert-contested" style={{ marginBottom: 18 }}>
            <div>
              <strong>Compact Runtime Initialization Error:</strong>{' '}
              <span className="mono">{initError}</span>
            </div>
          </div>
        )}

        {route === 'overview' && <OverviewPage onNavigate={setRoute} />}
        {route === 'tender' && (
          <TenderRoomPage
            session={session}
            onSessionUpdate={() => setTick((t) => t + 1)}
            onReset={initSession}
            onNavigate={setRoute}
          />
        )}
        {route === 'verify' && <VerifyPage />}
        {route === 'certificate' && <AwardCertificatePage session={session} />}
      </main>
    </div>
  );
}
