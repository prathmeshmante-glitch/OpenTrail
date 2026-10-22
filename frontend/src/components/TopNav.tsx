import React from 'react';
import { Compass, Sparkles, GitBranch, RefreshCw, ShieldCheck } from 'lucide-react';
import type { HealthResponse } from '../types';

interface TopNavProps {
  currentRepo: string | null;
  onNewAnalysis: () => void;
  onLoadSample: () => void;
  onOpenFirstContribution?: () => void;
  onOpenTestMap?: () => void;
  health: HealthResponse | null;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentRepo,
  onNewAnalysis,
  onLoadSample,
  onOpenFirstContribution,
  onOpenTestMap,
  health,
}) => {
  return (
    <header
      style={{
        borderBottom: 'var(--border-thick)',
        backgroundColor: '#FFFFFF',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          onClick={onNewAnalysis}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-electric-lime)',
              border: 'var(--border-thick)',
              boxShadow: 'var(--shadow-offset-sm)',
              padding: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Compass size={22} color="var(--color-ink)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                OPENTRAIL
              </span>
              <span className="badge badge-lime">v0.1</span>
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-ink-muted)',
                fontWeight: 600,
              }}
            >
              Navigate code. Trace impact. Contribute with confidence.
            </div>
          </div>
        </div>

        {currentRepo && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.75rem',
              border: 'var(--border-thick)',
              backgroundColor: 'var(--color-paper)',
              boxShadow: 'var(--shadow-offset-sm)',
            }}
          >
            <GitBranch size={16} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>
              {currentRepo}
            </span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {currentRepo && onOpenFirstContribution && (
          <button
            className="btn badge-lime"
            onClick={onOpenFirstContribution}
            title="Guided newcomer contribution onboarding"
            style={{ padding: '0.35rem 0.65rem' }}
          >
            <Compass size={14} />
            First Contribution
          </button>
        )}

        {currentRepo && onOpenTestMap && (
          <button
            className="btn"
            onClick={onOpenTestMap}
            title="Smart regression test discovery"
            style={{ padding: '0.35rem 0.65rem' }}
          >
            <ShieldCheck size={14} />
            Test Map
          </button>
        )}

        {health && (
          <div
            className={`badge ${health.ai_available ? 'badge-blue' : 'badge-lime'}`}
            title={`Backend: ${health.status} | Model: ${health.ai_model}`}
          >
            <Sparkles size={12} />
            {health.ai_available ? `Gemma 4: Online` : `Graphify AST: Active`}
          </div>
        )}

        <button className="btn" onClick={onLoadSample} title="Load demonstration test repository">
          <RefreshCw size={14} />
          Demo Sample
        </button>

        <button className="btn btn-primary" onClick={onNewAnalysis}>
          Explore Repo
        </button>
      </div>
    </header>
  );
};
