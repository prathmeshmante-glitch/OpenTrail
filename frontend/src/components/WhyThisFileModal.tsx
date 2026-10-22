import React, { useEffect, useState } from 'react';
import { X, FileCode, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import type { WhyThisFileResponse } from '../types';

interface WhyThisFileModalProps {
  repositoryId: string;
  filePath: string | null;
  issueText?: string;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
}

export const WhyThisFileModal: React.FC<WhyThisFileModalProps> = ({
  repositoryId,
  filePath,
  issueText,
  onClose,
  onSelectNode: _onSelectNode,
}) => {
  const [data, setData] = useState<WhyThisFileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    setError(null);
    api.explainWhyThisFile(repositoryId, filePath, issueText)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to explain file');
        setLoading(false);
      });
  }, [repositoryId, filePath, issueText]);

  if (!filePath) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(34, 34, 34, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '85vh',
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
            padding: '1rem 1.25rem',
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
              <FileCode size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-ink-muted)' }}>
                EVIDENCE-BACKED REPUTATION
              </div>
              <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                Why this file?
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'var(--border-thin)',
              background: 'none',
              cursor: 'pointer',
              padding: '0.2rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              padding: '0.65rem 0.85rem',
              border: 'var(--border-thin)',
              backgroundColor: 'var(--color-paper)',
              marginBottom: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{filePath}</span>
            {data && (
              <span
                className={`badge ${
                  data.match_type === 'direct'
                    ? 'badge-lime'
                    : data.match_type === 'transitive'
                    ? 'badge-blue'
                    : 'badge-coral'
                }`}
                style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}
              >
                {data.match_type} match
              </span>
            )}
          </div>

          {loading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
              Inspecting AST relationships and source evidence...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '0.75rem',
                border: 'var(--border-thick)',
                backgroundColor: '#FFEBE8',
                borderColor: '#D32F2F',
                color: '#B71C1C',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          {data && (() => {
            const matchedTerms = data.matched_terms || (data as any).matched_keywords || [];
            const verifiedSymbols = data.verified_symbols || [];
            const connectingEdges = data.connecting_edges || [];
            const sourceLocations = data.source_locations || ((data as any).source_snippet ? [(data as any).source_snippet] : []);
            const missingEvidence = Array.isArray(data.missing_evidence)
              ? data.missing_evidence
              : data.missing_evidence
              ? [String(data.missing_evidence)]
              : [];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Primary Reason */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.35rem' }}>
                    RELEVANCE EXPLANATION
                  </div>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                    {data.relevance_reason}
                  </p>
                </div>

                {/* Matched Issue Terms */}
                {matchedTerms.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.35rem' }}>
                      MATCHED ISSUE CONTEXT
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {matchedTerms.map((term, i) => (
                        <span key={i} className="badge badge-lime" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verified Symbols in this File */}
                {verifiedSymbols.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.35rem' }}>
                      VERIFIED AST SYMBOLS ({verifiedSymbols.length})
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {verifiedSymbols.map((sym, i) => (
                        <span
                          key={i}
                          className="badge"
                          style={{
                            backgroundColor: '#FFFFFF',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                          }}
                        >
                          <CheckCircle size={10} color="#2E7D32" />
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connecting Graph Edges */}
                {connectingEdges.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.35rem' }}>
                      CONNECTING GRAPH RELATIONSHIPS
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {connectingEdges.map((edge, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '0.35rem 0.6rem',
                            border: '1px solid var(--color-ink)',
                            backgroundColor: 'var(--color-paper)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                          }}
                        >
                          {edge}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source Locations */}
                {sourceLocations.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.35rem' }}>
                      INDEXED SOURCE LOCATIONS
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {sourceLocations.map((loc, i) => (
                        <span
                          key={i}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            padding: '0.1rem 0.4rem',
                            backgroundColor: '#FFFFFF',
                            border: '1px dashed var(--color-ink)',
                          }}
                        >
                          {loc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Caveats & Missing Evidence */}
                {missingEvidence.length > 0 && (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      backgroundColor: '#FFFDF0',
                      border: '1px solid #FFE082',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 800, marginBottom: '0.2rem' }}>
                      <AlertTriangle size={12} color="#F57C00" />
                      <span>CAVEATS & UNVERIFIED ASPECTS</span>
                    </div>
                    {missingEvidence.map((caveat, i) => (
                      <div key={i} style={{ color: 'var(--color-ink-muted)' }}>
                        • {caveat}
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
