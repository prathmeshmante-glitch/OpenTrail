import React, { useEffect, useState } from 'react';
import { X, CheckCircle, Search, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import type { TestMapResponse } from '../types';

interface TestMapModalProps {
  isOpen: boolean;
  repositoryId: string;
  initialTarget?: string;
  onClose: () => void;
  onSelectTestNode?: (nodeId: string) => void;
}

export const TestMapModal: React.FC<TestMapModalProps> = ({
  isOpen,
  repositoryId,
  initialTarget = '',
  onClose,
  onSelectTestNode,
}) => {
  const [targetQuery, setTargetQuery] = useState(initialTarget);
  const [data, setData] = useState<TestMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'existing' | 'proposed'>('all');

  const fetchTestMap = (query: string) => {
    setLoading(true);
    setError(null);
    api.getSmartTestMap(repositoryId, query.trim() || undefined)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to discover test map');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      setTargetQuery(initialTarget);
      fetchTestMap(initialTarget);
    }
  }, [isOpen, repositoryId, initialTarget]);

  if (!isOpen) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTestMap(targetQuery);
  };

  const existing = data?.existing_tests || [];
  const proposed = data?.proposed_tests || [];

  const displayedTests =
    activeTab === 'existing'
      ? existing
      : activeTab === 'proposed'
      ? proposed
      : [...existing, ...proposed];

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
          maxWidth: '850px',
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
            padding: '1rem 1.5rem',
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
                backgroundColor: 'var(--color-coral)',
                border: 'var(--border-thick)',
                padding: '0.35rem',
                display: 'flex',
              }}
            >
              <ShieldCheck size={20} color="var(--color-ink)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', lineHeight: 1.1 }}>Smart Regression Test Map</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>
                Evidence-backed test discovery & strict existence verification
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

        {/* Toolbar & Filter */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderBottom: 'var(--border-thin)',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-ink-muted)' }}
              />
              <input
                type="text"
                className="input"
                placeholder="Filter tests by target symbol (e.g. calculate_metrics)..."
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
                style={{ paddingLeft: '2.2rem', width: '100%', fontSize: '0.85rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.4rem 0.85rem' }}>
              Filter
            </button>
          </form>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              className={`badge ${activeTab === 'all' ? 'badge-lime' : ''}`}
              onClick={() => setActiveTab('all')}
              style={{ cursor: 'pointer' }}
            >
              All ({existing.length + proposed.length})
            </button>
            <button
              className={`badge ${activeTab === 'existing' ? 'badge-lime' : ''}`}
              onClick={() => setActiveTab('existing')}
              style={{ cursor: 'pointer' }}
            >
              Verified Existing ({existing.length})
            </button>
            <button
              className={`badge ${activeTab === 'proposed' ? 'badge-coral' : ''}`}
              onClick={() => setActiveTab('proposed')}
              style={{ cursor: 'pointer' }}
            >
              Proposed ({proposed.length})
            </button>
          </div>
        </div>

        {/* Caveat Banner */}
        <div
          style={{
            padding: '0.45rem 1.5rem',
            backgroundColor: '#FFFDF0',
            borderBottom: '1px solid #FFE082',
            fontSize: '0.75rem',
            color: 'var(--color-ink-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <AlertCircle size={14} color="#F57C00" />
          <span>
            OpenTrail strictly distinguishes tests verified on disk from proposed new tests. Unverified test execution claims are prevented.
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
              Analyzing AST test graph and mapping regression paths...
            </div>
          )}

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

          {!loading && displayedTests.length === 0 && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-ink-muted)' }}>
              No tests matching this symbol. Try searching for another symbol or clearing the filter.
            </div>
          )}

          {!loading && displayedTests.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {displayedTests.map((test, idx) => {
                const isVerified = test.state === 'Existing test — verified';
                const testName = test.name || (test as any).test_name || 'Unnamed Test';
                const testFile = test.file_path || (test as any).test_file || '';
                const testNodeId = test.node_id || (test as any).test_node_id || null;
                const testLoc = test.source_location || ((test as any).line_start ? `L${(test as any).line_start}` : null);

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '0.85rem 1rem',
                      border: 'var(--border-thick)',
                      backgroundColor: '#FFFFFF',
                      boxShadow: 'var(--shadow-offset-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.95rem' }}>
                          {testName}
                        </span>
                        {isVerified ? (
                          <span className="badge badge-lime" style={{ fontSize: '0.7rem' }}>
                            <CheckCircle size={10} /> {test.state}
                          </span>
                        ) : (
                          <span className="badge badge-coral" style={{ fontSize: '0.7rem' }}>
                            {test.state}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          className="badge"
                          title="Relevance ranking score computed from AST connection distance"
                          style={{ fontSize: '0.7rem', fontWeight: 800 }}
                        >
                          Relevance: {test.relevance_score}%
                        </span>
                        {testNodeId && onSelectTestNode && (
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              onSelectTestNode(testNodeId);
                              onClose();
                            }}
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                          >
                            Focus in Graph
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Location & Reason */}
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.4rem', fontFamily: 'var(--font-mono)' }}>
                      <span>{testFile}</span>
                      {testLoc && <span> : {testLoc}</span>}
                    </div>

                    <p style={{ fontSize: '0.85rem', lineHeight: 1.4, margin: '0 0 0.4rem 0' }}>
                      {test.relevance_reason}
                    </p>

                    {/* Evidence Path */}
                    {test.evidence_path.length > 0 && (
                      <div
                        style={{
                          padding: '0.35rem 0.6rem',
                          backgroundColor: 'var(--color-paper)',
                          border: '1px dashed var(--color-ink)',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--color-ink-muted)' }}>Evidence Path:</span>
                        {test.evidence_path.map((hop, hIdx) => (
                          <React.Fragment key={hIdx}>
                            <span>{hop}</span>
                            {hIdx < test.evidence_path.length - 1 && <ArrowRight size={10} />}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
