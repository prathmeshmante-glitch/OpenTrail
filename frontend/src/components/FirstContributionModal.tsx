import React, { useState } from 'react';
import { X, Compass, Sparkles, BookOpen, CheckSquare, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { FirstContributionPlan } from '../types';

interface FirstContributionModalProps {
  isOpen: boolean;
  repositoryId: string;
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onExplainFile: (filePath: string) => void;
}

export const FirstContributionModal: React.FC<FirstContributionModalProps> = ({
  isOpen,
  repositoryId,
  onClose,
  onFocusNode,
  onExplainFile,
}) => {
  const [issueText, setIssueText] = useState('');
  const [issueUrl, setIssueUrl] = useState('');
  const [plan, setPlan] = useState<FirstContributionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.generateFirstContributionPlan(
        repositoryId,
        issueText.trim(),
        issueUrl.trim() || undefined
      );
      setPlan(res);
      setCompletedSteps(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to generate contribution plan');
    } finally {
      setLoading(false);
    }
  };

  const toggleStep = (stepNum: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) next.delete(stepNum);
      else next.add(stepNum);
      return next;
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(34, 34, 34, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          backgroundColor: '#FFFFFF',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
                padding: '0.35rem',
                display: 'flex',
              }}
            >
              <Compass size={20} color="var(--color-ink)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', lineHeight: 1.1 }}>First Contribution Mode</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                Guided newcomer onboarding grounded in real code relationships
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

        {/* Input Form */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: 'var(--border-thin)', backgroundColor: '#FFFFFF' }}>
          <form onSubmit={handleGenerate}>
            <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.35rem' }}>
              DESCRIBE THE TASK OR REPRODUCED ISSUE
            </div>
            <textarea
              className="input"
              rows={2}
              placeholder="e.g. Need to understand how routes are registered in Bottle and add a test for trailing slashes..."
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              disabled={loading}
              style={{ width: '100%', marginBottom: '0.5rem', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="input"
                placeholder="Optional issue URL (https://github.com/...)"
                value={issueUrl}
                onChange={(e) => setIssueUrl(e.target.value)}
                disabled={loading}
                style={{ flex: 1, fontSize: '0.85rem' }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || issueText.trim().length < 5}
              >
                {loading ? 'Synthesizing Onboarding Trail...' : (
                  <>
                    <Sparkles size={16} />
                    Generate Contribution Guide
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '0.85rem',
                border: 'var(--border-thick)',
                backgroundColor: '#FFEBE8',
                borderColor: '#D32F2F',
                color: '#B71C1C',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}
            >
              {error}
            </div>
          )}

          {!plan && !loading && (
            <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
              <Compass size={36} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-ink)', marginBottom: '0.5rem' }}>
                Welcome to First Contribution Mode
              </div>
              <p style={{ maxWidth: '460px', margin: '0 auto', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Entering an unfamiliar repository can be intimidating. OpenTrail analyzes the code graph, extracts verified files and architectural hubs, and lays out a beginner-friendly path to make your first change with confidence.
              </p>
            </div>
          )}

          {plan && (() => {
            const readingOrderFiles = Array.isArray(plan.reading_order_files) ? plan.reading_order_files : [];
            const keyComponents = (plan.key_components && typeof plan.key_components === 'object') ? plan.key_components : {};
            const stepByStepGuide = Array.isArray(plan.step_by_step_guide) ? plan.step_by_step_guide : [];
            const suggestedTests = Array.isArray(plan.suggested_tests) ? plan.suggested_tests : [];
            const cautionaryNotes = Array.isArray(plan.cautionary_notes) ? plan.cautionary_notes : [];

            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Beginner Summary Card */}
              <div
                style={{
                  padding: '1.25rem',
                  border: 'var(--border-thick)',
                  backgroundColor: 'var(--color-paper)',
                  boxShadow: 'var(--shadow-offset-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.5rem' }}>
                  <BookOpen size={16} color="var(--color-cobalt-blue)" />
                  <span>PLAIN-ENGLISH ORIENTATION</span>
                </div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{plan.issue_title}</h3>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                  {plan.beginner_summary}
                </p>
              </div>

              {/* Recommended Reading Order */}
              {readingOrderFiles.length > 0 && (
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                    1. RECOMMENDED FILE READING ORDER ({readingOrderFiles.length} files)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {readingOrderFiles.map((file, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.6rem 0.85rem',
                          border: 'var(--border-thin)',
                          backgroundColor: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-electric-lime)',
                              border: '1px solid var(--color-ink)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.85rem' }}>
                            {file}
                          </span>
                        </div>
                        <button
                          className="btn"
                          onClick={() => onExplainFile(file)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Why this file?
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Components Plain English */}
              {Object.keys(keyComponents).length > 0 && (
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.6rem' }}>
                    2. KEY ARCHITECTURAL ROLES
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem' }}>
                    {Object.entries(keyComponents).map(([sym, role], idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.75rem',
                          border: 'var(--border-thin)',
                          backgroundColor: 'var(--color-paper)',
                        }}
                      >
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          {sym}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>
                          {String(role)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step by Step Action Checklist */}
              {stepByStepGuide.length > 0 && (
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>3. STEP-BY-STEP CONTRIBUTION WORKFLOW</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                      {completedSteps.size} of {stepByStepGuide.length} completed
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {stepByStepGuide.map((step) => {
                      const isDone = completedSteps.has(step.step_number);
                      return (
                        <div
                          key={step.step_number}
                          style={{
                            padding: '0.85rem',
                            border: 'var(--border-thick)',
                            backgroundColor: isDone ? 'var(--color-paper)' : '#FFFFFF',
                            boxShadow: 'var(--shadow-offset-sm)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.75rem',
                          }}
                        >
                          <button
                            onClick={() => toggleStep(step.step_number)}
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              marginTop: '0.15rem',
                            }}
                          >
                            <CheckSquare
                              size={18}
                              color={isDone ? '#2E7D32' : 'var(--color-ink-muted)'}
                            />
                          </button>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: '0.9rem',
                                  textDecoration: isDone ? 'line-through' : 'none',
                                }}
                              >
                                Step {step.step_number}: {step.title}
                              </span>
                              <span className="badge badge-lime" style={{ fontSize: '0.65rem' }}>
                                {step.evidence_badge}
                              </span>
                            </div>

                            <p style={{ fontSize: '0.85rem', margin: '0 0 0.4rem 0', lineHeight: 1.4 }}>
                              {step.description}
                            </p>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-muted)' }}>
                                Target: {step.recommended_file}
                              </span>
                              {step.target_node_id && (
                                <button
                                  className="btn btn-primary"
                                  onClick={() => {
                                    onFocusNode(step.target_node_id!);
                                    onClose();
                                  }}
                                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                                >
                                  Focus in Graph
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Regression Tests */}
              {suggestedTests.length > 0 && (
                <div
                  style={{
                    padding: '1rem',
                    border: 'var(--border-thin)',
                    backgroundColor: 'var(--color-paper)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    <ShieldCheck size={16} color="var(--color-coral)" />
                    <span>SUGGESTED REGRESSION VERIFICATION</span>
                  </div>
                  <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.85rem', lineHeight: 1.6 }}>
                    {suggestedTests.map((t, idx) => (
                      <li key={idx} style={{ fontFamily: 'var(--font-mono)' }}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cautionary Notes */}
              {cautionaryNotes.length > 0 && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#FFFDF0',
                    border: '1px solid #FFE082',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                    <AlertCircle size={14} color="#F57C00" />
                    <span>CONTRIBUTOR NOTES & CONVENTIONS</span>
                  </div>
                  {cautionaryNotes.map((note, idx) => (
                    <div key={idx} style={{ color: 'var(--color-ink-muted)', marginBottom: '0.2rem' }}>
                      • {note}
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
