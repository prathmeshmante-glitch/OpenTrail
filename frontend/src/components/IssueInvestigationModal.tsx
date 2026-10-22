import React, { useState } from 'react';
import { X, Sparkles, CheckCircle, Bug, ListChecks, ArrowRight, AlertTriangle, Share2 } from 'lucide-react';
import type { InvestigationRecommendation, InvestigationResponse } from '../types';

interface IssueInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitIssue: (issueText: string, issueUrl?: string) => Promise<void>;
  investigation: InvestigationResponse | null;
  isLoading: boolean;
  onHighlightComponents: (nodeIds: string[]) => void;
  onSelectComponent: (nodeId: string) => void;
}

export const IssueInvestigationModal: React.FC<IssueInvestigationModalProps> = ({
  isOpen,
  onClose,
  onSubmitIssue,
  investigation,
  isLoading,
  onHighlightComponents,
  onSelectComponent,
}) => {
  const [issueText, setIssueText] = useState('');
  const [issueUrl, setIssueUrl] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (issueText.trim().length >= 5) {
      onSubmitIssue(issueText.trim(), issueUrl.trim() || undefined);
    }
  };

  const rec: InvestigationRecommendation | null = investigation?.recommendations || null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(34, 34, 34, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: 'var(--border-thick)',
            backgroundColor: 'var(--color-paper)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                backgroundColor: 'var(--color-electric-lime)',
                border: 'var(--border-thick)',
                padding: '0.3rem',
                display: 'flex',
              }}
            >
              <Bug size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', lineHeight: 1.1 }}>Grounded Issue Investigation</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                Powered by Gemma 4 + AST Relationship Evidence
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: 'var(--border-thin)',
              background: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Issue Input Form */}
          <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 800,
                fontSize: '0.85rem',
                marginBottom: '0.4rem',
              }}
            >
              PASTE ISSUE DESCRIPTION OR BUG REPORT
            </label>
            <textarea
              className="input"
              rows={3}
              placeholder="e.g. MetricProcessor calculation fails with empty list in processor.py..."
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              disabled={isLoading}
              style={{ resize: 'vertical', marginBottom: '0.75rem' }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input"
                placeholder="Optional GitHub Issue URL (https://github.com/owner/repo/issues/123)"
                value={issueUrl}
                onChange={(e) => setIssueUrl(e.target.value)}
                disabled={isLoading}
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading || issueText.trim().length < 5}
              >
                {isLoading ? (
                  'Analyzing with Gemma 4...'
                ) : (
                  <>
                    <Sparkles size={16} />
                    Investigate Impact
                  </>
                )}
              </button>
            </div>
          </form>

          {/* AI / Investigation Error Banner */}
          {investigation?.error && (
            <div
              style={{
                padding: '0.85rem 1rem',
                border: 'var(--border-thick)',
                backgroundColor: '#FFEBE8',
                borderColor: '#D32F2F',
                boxShadow: 'var(--shadow-offset-sm)',
                marginBottom: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#D32F2F', fontWeight: 800, fontSize: '0.9rem' }}>
                <AlertTriangle size={18} />
                <span>AI SERVICE ERROR</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#B71C1C', margin: 0, lineHeight: 1.4 }}>
                {investigation.error}
              </p>
            </div>
          )}

          {/* Investigation Results */}
          {rec && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Summary Card */}
              <div
                style={{
                  padding: '1rem',
                  border: 'var(--border-thick)',
                  backgroundColor: 'var(--color-paper)',
                  boxShadow: 'var(--shadow-offset-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span className="badge badge-lime">INVESTIGATION SUMMARY</span>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const verified = rec.relevant_components
                        .filter((c) => c.is_verified)
                        .map((c) => c.node_id);
                      onHighlightComponents(
                        verified.length > 0 ? verified : rec.relevant_components.map((c) => c.node_id)
                      );
                    }}
                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
                  >
                    Highlight All on Canvas
                  </button>
                </div>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  {rec.issue_summary}
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}>
                  {rec.reasoning_summary}
                </p>
              </div>

              {/* Relevant Components */}
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  RELEVANT REPOSITORY COMPONENTS ({rec.relevant_components.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {rec.relevant_components.map((comp) => (
                    <div
                      key={comp.node_id}
                      onClick={() => onSelectComponent(comp.node_id)}
                      style={{
                        padding: '0.75rem',
                        border: 'var(--border-thick)',
                        backgroundColor: '#FFFFFF',
                        boxShadow: 'var(--shadow-offset-sm)',
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-paper)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.9rem' }}>
                          {comp.label}
                        </span>
                        {comp.is_verified ? (
                          <span className="badge badge-lime" title="Confirmed in AST Graph">
                            <CheckCircle size={10} /> Verified
                          </span>
                        ) : (
                          <span className="badge badge-coral" title="Unindexed symbol reference">
                            Hypothesis
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span>{comp.file_path}</span>
                        {comp.line_start != null && (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.7rem',
                              padding: '0.05rem 0.3rem',
                              backgroundColor: 'var(--color-paper)',
                              border: '1px solid var(--color-ink)',
                              fontWeight: 700,
                              color: 'var(--color-ink)',
                            }}
                          >
                            {comp.line_end && comp.line_end !== comp.line_start
                              ? `L${comp.line_start}-L${comp.line_end}`
                              : `L${comp.line_start}`}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.8rem' }}>{comp.relevance_reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Call Relationships & Graph Evidence */}
              {rec.confirmed_relationships && rec.confirmed_relationships.length > 0 && (
                <div
                  style={{
                    padding: '0.85rem',
                    border: 'var(--border-thin)',
                    backgroundColor: 'var(--color-paper)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    <Share2 size={16} />
                    CALL RELATIONSHIPS & GRAPH EVIDENCE
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {rec.confirmed_relationships.map((rel, idx) => {
                      const isVerified = rel.startsWith('[Verified AST Edge]');
                      const cleanText = rel.replace(/^\[(Verified AST Edge|Model Inferred Relationship)\]\s*/, '');
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.35rem 0.6rem',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid var(--color-ink)',
                            fontSize: '0.8rem',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <span>{cleanText}</span>
                          {isVerified ? (
                            <span className="badge badge-lime" style={{ fontSize: '0.65rem' }}>
                              Direct AST Edge
                            </span>
                          ) : (
                            <span className="badge badge-coral" style={{ fontSize: '0.65rem' }}>
                              Model Inferred
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommended Testing & Next Steps */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div
                  style={{
                    padding: '0.85rem',
                    border: 'var(--border-thin)',
                    backgroundColor: 'var(--color-paper)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    <ListChecks size={16} />
                    SUGGESTED TESTS
                  </div>
                  <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    {rec.suggested_tests.map((t, idx) => {
                      const isExisting = t.startsWith('[Existing Test]');
                      const isProposed = t.startsWith('[Proposed New Test]');
                      const cleanTest = t.replace(/^\[(Existing Test|Proposed New Test)\]\s*/, '');
                      return (
                        <li key={idx} style={{ marginBottom: '0.25rem' }}>
                          {isExisting && (
                            <span className="badge badge-lime" style={{ fontSize: '0.65rem', marginRight: '0.4rem' }}>
                              Existing Test
                            </span>
                          )}
                          {isProposed && (
                            <span className="badge badge-coral" style={{ fontSize: '0.65rem', marginRight: '0.4rem' }}>
                              Proposed New Test
                            </span>
                          )}
                          <span>{cleanTest}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div
                  style={{
                    padding: '0.85rem',
                    border: 'var(--border-thin)',
                    backgroundColor: 'var(--color-paper)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    <ArrowRight size={16} />
                    INVESTIGATION STEPS
                  </div>
                  <ol style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', lineHeight: 1.6 }}>
                    {rec.investigation_steps.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Uncertainties & Caveats */}
              {rec.uncertainties.length > 0 && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    border: 'var(--border-thin)',
                    backgroundColor: '#FFFDF0',
                    fontSize: '0.8rem',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '0.2rem', color: 'var(--color-ink)' }}>
                    CAVEATS & UNCERTAINTIES
                  </div>
                  {rec.uncertainties.map((u, idx) => (
                    <div key={idx}>• {u}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
