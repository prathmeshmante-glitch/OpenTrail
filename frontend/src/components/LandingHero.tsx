import React, { useState } from 'react';
import { ArrowRight, Network, Bug, ShieldCheck, Compass, GitCommit, Sparkles } from 'lucide-react';

interface LandingHeroProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  onLoadSample: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onSubmit,
  isLoading,
  onLoadSample,
}) => {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError('Please enter a GitHub repository URL.');
      return;
    }

    if (!trimmed.startsWith('https://github.com/')) {
      setValidationError('Only public HTTPS GitHub URLs are supported (e.g. https://github.com/owner/repo).');
      return;
    }

    const parts = trimmed.replace('https://github.com/', '').split('/');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      setValidationError('Please provide a valid repository URL in the format https://github.com/owner/repo');
      return;
    }

    onSubmit(trimmed);
  };

  const handleQuickSelect = (quickUrl: string) => {
    setUrl(quickUrl);
    setValidationError(null);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 1.5rem' }}>
      {/* Hero Headline Section */}
      <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.9rem',
            border: 'var(--border-thick)',
            backgroundColor: 'var(--color-electric-lime)',
            boxShadow: 'var(--shadow-offset-sm)',
            fontWeight: 800,
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
          }}
        >
          <Compass size={16} />
          AST GRAPH EXTRACTION + GROUNDED GEMMA 4 INTELLIGENCE
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.2rem)',
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: '1.25rem',
          }}
        >
          Find your way around <br />
          <span
            style={{
              backgroundColor: 'var(--color-electric-lime)',
              padding: '0 0.35rem',
              border: 'var(--border-thick)',
              boxShadow: 'var(--shadow-offset-sm)',
            }}
          >
            any codebase.
          </span>
        </h1>

        <p
          style={{
            fontSize: '1.25rem',
            color: 'var(--color-ink-muted)',
            maxWidth: '680px',
            margin: '0 auto 2.5rem auto',
            fontWeight: 500,
          }}
        >
          Understand how a project works, discover where an issue lives, and make your next contribution with confidence.
        </p>

        {/* Input Form Card */}
        <div
          className="card"
          style={{
            maxWidth: '750px',
            margin: '0 auto',
            backgroundColor: '#FFFFFF',
            textAlign: 'left',
          }}
        >
          <form onSubmit={handleSubmit}>
            <label
              htmlFor="repo-input"
              style={{
                display: 'block',
                fontWeight: 800,
                fontSize: '0.9rem',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Public GitHub Repository
            </label>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                id="repo-input"
                type="text"
                className="input"
                placeholder="https://github.com/owner/repository"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                style={{ flex: '1 1 320px' }}
              />

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{ minWidth: '190px' }}
              >
                {isLoading ? (
                  'Analyzing...'
                ) : (
                  <>
                    Explore repository
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>

            {validationError && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--color-coral)',
                  border: 'var(--border-thick)',
                  boxShadow: 'var(--shadow-offset-sm)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                {validationError}
              </div>
            )}
          </form>

          {/* Quick links */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '1.25rem',
              flexWrap: 'wrap',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            <span style={{ color: 'var(--color-ink-muted)' }}>Try immediately:</span>
            <button
              className="badge badge-lime"
              onClick={onLoadSample}
              style={{ cursor: 'pointer' }}
            >
              ★ Preloaded Demo (opentrail/sample)
            </button>
            <button
              className="badge"
              onClick={() => handleQuickSelect('https://github.com/pallets/flask')}
              style={{ cursor: 'pointer' }}
            >
              pallets/flask
            </button>
            <button
              className="badge"
              onClick={() => handleQuickSelect('https://github.com/fastapi/fastapi')}
              style={{ cursor: 'pointer' }}
            >
              fastapi/fastapi
            </button>
          </div>
        </div>
      </div>

      {/* 3 Core Benefits */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          marginBottom: '3.5rem',
        }}
      >
        <div className="card">
          <div
            style={{
              width: '42px',
              height: '42px',
              backgroundColor: 'var(--color-cobalt-blue)',
              border: 'var(--border-thick)',
              boxShadow: 'var(--shadow-offset-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <Network size={22} color="var(--color-ink)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>See how code connects</h3>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.95rem' }}>
            Graphify extracts real abstract syntax tree (AST) call graphs, class inheritances, and cross-file dependencies.
          </p>
        </div>

        <div className="card">
          <div
            style={{
              width: '42px',
              height: '42px',
              backgroundColor: 'var(--color-coral)',
              border: 'var(--border-thick)',
              boxShadow: 'var(--shadow-offset-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <Bug size={22} color="var(--color-ink)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Find where an issue lives</h3>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.95rem' }}>
            Submit an issue description to identify relevant components without sifting through thousands of unfamiliar lines.
          </p>
        </div>

        <div className="card">
          <div
            style={{
              width: '42px',
              height: '42px',
              backgroundColor: 'var(--color-electric-lime)',
              border: 'var(--border-thick)',
              boxShadow: 'var(--shadow-offset-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}
          >
            <ShieldCheck size={22} color="var(--color-ink)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Understand what to inspect</h3>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.95rem' }}>
            Receive an evidence-backed test plan and impact radius grounded in verified graph relationships—not generic chat.
          </p>
        </div>
      </div>

      {/* Illustrative Concept Diagram (Explicitly labeled as Example) */}
      <div className="card card-paper" style={{ padding: '2rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <span className="badge badge-coral" style={{ marginBottom: '0.35rem' }}>
              CONCEPT PREVIEW (ILLUSTRATIVE EXAMPLE)
            </span>
            <h3 style={{ fontSize: '1.25rem' }}>Issue-to-Impact Intelligence in Action</h3>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
            Real analysis will render your repository's actual code graph.
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            position: 'relative',
          }}
        >
          <div
            style={{
              border: 'var(--border-thick)',
              backgroundColor: '#FFFFFF',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-offset-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Bug size={18} color="var(--color-coral)" />
              <strong style={{ fontSize: '0.95rem' }}>1. Submitted Issue</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
              "MetricProcessor fails when processing metrics in processor.py"
            </p>
          </div>

          <div
            style={{
              border: 'var(--border-thick)',
              backgroundColor: 'var(--color-cobalt-blue)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-offset-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <GitCommit size={18} />
              <strong style={{ fontSize: '0.95rem' }}>2. AST Grounding</strong>
            </div>
            <p style={{ fontSize: '0.85rem' }}>
              <strong>MetricProcessor</strong> (Class, L4) <br />
              → Calls <strong>calculate_metrics</strong> (Func, L1)
            </p>
          </div>

          <div
            style={{
              border: 'var(--border-thick)',
              backgroundColor: 'var(--color-electric-lime)',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-offset-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Sparkles size={18} />
              <strong style={{ fontSize: '0.95rem' }}>3. Verified Plan</strong>
            </div>
            <p style={{ fontSize: '0.85rem' }}>
              Downstream consumer: <strong>main()</strong> <br />
              Suggested test: <code>test_processor.py</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
