import React from 'react';
import { Sparkles, Layers, Cpu } from 'lucide-react';
import type { GraphNode, RepositoryGraph } from '../types';

interface WorkspaceSidebarProps {
  graph: RepositoryGraph;
  onSelectNode: (node: GraphNode) => void;
  onOpenInvestigation: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  graph,
  onSelectNode,
  onOpenInvestigation,
}) => {
  return (
    <aside
      style={{
        width: '320px',
        backgroundColor: '#FFFFFF',
        borderRight: 'var(--border-thick)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Investigation Trigger Card */}
      <div style={{ padding: '1rem', borderBottom: 'var(--border-thick)' }}>
        <button
          className="btn btn-primary"
          onClick={onOpenInvestigation}
          style={{ width: '100%', padding: '0.85rem' }}
        >
          <Sparkles size={18} />
          Investigate Issue
        </button>
      </div>

      {/* Metrics Card */}
      <div style={{ padding: '1rem', borderBottom: 'var(--border-thick)' }}>
        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.5rem' }}>
          REPOSITORY METRICS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div
            style={{
              padding: '0.5rem',
              border: 'var(--border-thin)',
              backgroundColor: 'var(--color-paper)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>Nodes</div>
            <div style={{ fontWeight: 900, fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>
              {graph.statistics.total_nodes}
            </div>
          </div>
          <div
            style={{
              padding: '0.5rem',
              border: 'var(--border-thin)',
              backgroundColor: 'var(--color-paper)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>Connections</div>
            <div style={{ fontWeight: 900, fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>
              {graph.statistics.total_edges}
            </div>
          </div>
          <div
            style={{
              padding: '0.5rem',
              border: 'var(--border-thin)',
              backgroundColor: 'var(--color-paper)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>Files</div>
            <div style={{ fontWeight: 900, fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>
              {graph.statistics.total_files}
            </div>
          </div>
          <div
            style={{
              padding: '0.5rem',
              border: 'var(--border-thin)',
              backgroundColor: 'var(--color-paper)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>Communities</div>
            <div style={{ fontWeight: 900, fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>
              {graph.statistics.total_communities}
            </div>
          </div>
        </div>
      </div>

      {/* Architectural Hubs ("God Nodes") */}
      <div style={{ padding: '1rem', borderBottom: 'var(--border-thick)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.5rem' }}>
          <Cpu size={14} />
          ARCHITECTURAL HUBS ({graph.hub_nodes.length})
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {graph.hub_nodes.slice(0, 6).map((hub) => {
            const rawNode = graph.nodes.find((n) => n.id === hub.id);
            return (
              <div
                key={hub.id}
                onClick={() => rawNode && onSelectNode(rawNode)}
                style={{
                  padding: '0.45rem 0.65rem',
                  border: 'var(--border-thin)',
                  backgroundColor: '#FFFFFF',
                  boxShadow: 'var(--shadow-offset-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-paper)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '180px',
                  }}
                  title={hub.label}
                >
                  {hub.label}
                </span>
                <span className="badge badge-coral" style={{ fontSize: '0.65rem' }}>
                  deg {hub.degree}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cross-file Surprises */}
      {graph.surprises.length > 0 && (
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginBottom: '0.5rem' }}>
            <Layers size={14} />
            CROSS-FILE BRIDGES ({graph.surprises.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {graph.surprises.slice(0, 4).map((s, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.5rem',
                  border: 'var(--border-thin)',
                  backgroundColor: 'var(--color-paper)',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: '0.2rem' }}>
                  {s.source} → {s.target}
                </div>
                <div style={{ color: 'var(--color-ink-muted)' }}>{s.why}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
