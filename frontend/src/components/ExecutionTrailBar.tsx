import React, { useState } from 'react';
import { Route, ArrowLeft, ArrowRight, RotateCcw, FileText, CheckCircle, HelpCircle } from 'lucide-react';
import type { ExecutionTrailResponse } from '../types';

interface ExecutionTrailBarProps {
  trail: ExecutionTrailResponse | null;
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  onReset: () => void;
}

export const ExecutionTrailBar: React.FC<ExecutionTrailBarProps> = ({
  trail,
  currentStepIndex,
  onStepChange,
  onReset,
}) => {
  const [showExcerpt, setShowExcerpt] = useState(false);

  if (!trail || trail.steps.length === 0) return null;

  const currentStep = trail.steps[currentStepIndex] || trail.steps[0];
  const total = trail.steps.length;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        width: '90%',
        maxWidth: '720px',
        backgroundColor: '#FFFFFF',
        border: 'var(--border-thick)',
        boxShadow: 'var(--shadow-offset)',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
      }}
    >
      {/* Top Bar with Step Counters & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              backgroundColor: 'var(--color-cobalt-blue)',
              color: '#FFFFFF',
              border: 'var(--border-thick)',
              padding: '0.2rem 0.45rem',
              fontWeight: 800,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <Route size={14} />
            TRAIL HOP {currentStep.step_number || (currentStepIndex + 1)}/{total}
          </div>
          <span className="badge badge-lime" style={{ fontSize: '0.7rem' }}>
            {trail.trail_type}
          </span>
          {currentStep.is_structurally_extracted ? (
            <span className="badge" title="Extracted from Tree-Sitter AST" style={{ fontSize: '0.65rem' }}>
              <CheckCircle size={10} color="#2E7D32" /> {currentStep.provenance}
            </span>
          ) : (
            <span className="badge badge-coral" style={{ fontSize: '0.65rem' }}>
              <HelpCircle size={10} /> {currentStep.provenance}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            className="btn"
            onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex === 0}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            <ArrowLeft size={12} />
            Prev Hop
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onStepChange(Math.min(total - 1, currentStepIndex + 1))}
            disabled={currentStepIndex === total - 1}
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
          >
            Next Hop
            <ArrowRight size={12} />
          </button>
          <button
            className="btn"
            onClick={onReset}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
            title="Reset and clear execution trail"
          >
            <RotateCcw size={12} />
            Exit Trail
          </button>
        </div>
      </div>

      {/* Step Detail Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color-paper)',
          padding: '0.5rem 0.75rem',
          border: 'var(--border-thin)',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
            {currentStep.label}
          </span>
          <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>
            {currentStep.kind}
          </span>
          <span style={{ color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            {currentStep.file_path} {currentStep.source_location ? `: ${currentStep.source_location}` : ''}
          </span>
          {currentStep.incoming_relation && (
            <span className="badge badge-lime" style={{ fontSize: '0.65rem' }}>
              via: {currentStep.incoming_relation}
            </span>
          )}
        </div>

        {currentStep.source_excerpt && (
          <button
            className="badge"
            onClick={() => setShowExcerpt(!showExcerpt)}
            style={{ cursor: 'pointer', fontSize: '0.7rem' }}
          >
            <FileText size={10} />
            {showExcerpt ? 'Hide Source' : 'View Source'}
          </button>
        )}
      </div>

      {/* Source Excerpt Popout */}
      {showExcerpt && currentStep.source_excerpt && (
        <pre
          style={{
            margin: 0,
            padding: '0.65rem',
            backgroundColor: '#1E1E1E',
            color: '#D4D4D4',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            overflowX: 'auto',
            border: 'var(--border-thin)',
            maxHeight: '120px',
          }}
        >
          {currentStep.source_excerpt}
        </pre>
      )}

      {/* Stepper Dots */}
      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
        {trail.steps.map((st, i) => (
          <div
            key={i}
            onClick={() => onStepChange(i)}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor:
                i === currentStepIndex
                  ? 'var(--color-electric-lime)'
                  : i < currentStepIndex
                  ? 'var(--color-cobalt-blue)'
                  : '#D3CDBC',
              border: '1.5px solid var(--color-ink)',
              cursor: 'pointer',
              transition: 'transform 0.1s ease',
              transform: i === currentStepIndex ? 'scale(1.2)' : 'none',
            }}
            title={`Hop ${st.step_number}: ${st.label}`}
          />
        ))}
      </div>
    </div>
  );
};
