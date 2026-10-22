import React from 'react';
import { CheckCircle2, Circle, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { JobStage, JobStatusResponse } from '../types';

interface ProcessingViewProps {
  job: JobStatusResponse | null;
  onCancel: () => void;
}

const STAGES: { key: JobStage; label: string; desc: string }[] = [
  { key: 'validating', label: '1. Validating repository', desc: 'Verifying URL syntax and security boundaries' },
  { key: 'fetching', label: '2. Fetching source', desc: 'Performing safe shallow git clone' },
  { key: 'extracting', label: '3. Extracting code relationships', desc: 'Graphify tree-sitter AST extraction' },
  { key: 'preparing', label: '4. Preparing graph data', desc: 'Normalizing graph schema and computing hubs' },
  { key: 'ready', label: '5. Ready to explore', desc: 'Interactive relationship canvas ready' },
];

export const ProcessingView: React.FC<ProcessingViewProps> = ({ job, onCancel }) => {
  const currentStage = job?.stage || 'validating';
  const isFailed = currentStage === 'failed';

  const getStageIndex = (stage: JobStage) => {
    switch (stage) {
      case 'validating': return 0;
      case 'fetching': return 1;
      case 'extracting': return 2;
      case 'preparing': return 3;
      case 'ready': return 4;
      case 'failed': return -1;
      default: return 0;
    }
  };

  const currentIndex = getStageIndex(currentStage);

  return (
    <div style={{ maxWidth: '750px', margin: '4rem auto', padding: '0 1.5rem' }}>
      <div className="card" style={{ backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <span className="badge badge-lime" style={{ marginBottom: '0.25rem' }}>
              BACKGROUND EXTRACTION PIPELINE
            </span>
            <h2 style={{ fontSize: '1.5rem' }}>Analyzing Repository</h2>
          </div>
          <button className="btn" onClick={onCancel} style={{ fontSize: '0.85rem' }}>
            <ArrowLeft size={14} />
            Back
          </button>
        </div>

        {/* Real Progress Bar */}
        <div
          style={{
            height: '14px',
            border: 'var(--border-thick)',
            backgroundColor: 'var(--color-paper)',
            marginBottom: '2rem',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${job?.progress || 10}%`,
              backgroundColor: isFailed ? 'var(--color-coral)' : 'var(--color-electric-lime)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        {/* Live Message */}
        <div
          style={{
            padding: '0.75rem 1rem',
            border: 'var(--border-thick)',
            backgroundColor: isFailed ? 'var(--color-coral)' : 'var(--color-paper)',
            boxShadow: 'var(--shadow-offset-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          {isFailed ? (
            <AlertTriangle size={18} color="var(--color-ink)" />
          ) : (
            <Loader2 size={18} className="animate-spin" />
          )}
          <span>{job?.error || job?.message || 'Processing repository...'}</span>
        </div>

        {/* Stage List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {STAGES.map((s, idx) => {
            const isCompleted = currentIndex > idx || currentStage === 'ready';
            const isCurrent = currentIndex === idx && !isFailed;

            return (
              <div
                key={s.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  border: isCurrent ? 'var(--border-thick)' : 'var(--border-thin)',
                  backgroundColor: isCurrent ? 'var(--color-electric-lime)' : isCompleted ? '#F9F9F9' : '#FFFFFF',
                  boxShadow: isCurrent ? 'var(--shadow-offset-sm)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ marginTop: '2px' }}>
                  {isCompleted ? (
                    <CheckCircle2 size={20} color="var(--color-ink)" />
                  ) : isCurrent ? (
                    <Loader2 size={20} className="animate-spin" color="var(--color-ink)" />
                  ) : (
                    <Circle size={20} color="var(--color-ink-faint)" />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{s.label}</div>
                  <div style={{ fontSize: '0.8rem', color: isCurrent ? 'var(--color-ink)' : 'var(--color-ink-muted)' }}>
                    {s.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {isFailed && (
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={onCancel}>
              Try another repository
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
