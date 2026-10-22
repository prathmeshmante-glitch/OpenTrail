import React from 'react';
import { X, ArrowDownRight, ArrowUpRight, ShieldAlert, Copy, Check } from 'lucide-react';
import type { GraphNode, RepositoryGraph } from '../types';

interface DetailPanelProps {
  node: GraphNode | null;
  graph: RepositoryGraph;
  onClose: () => void;
  onSelectNode: (node: GraphNode) => void;
  onCheckImpact: (nodeId: string) => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  node,
  graph,
  onClose,
  onSelectNode,
  onCheckImpact,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!node) return null;

  // Find incoming and outgoing edges for this node
  const incomingEdges = graph.edges.filter((e) => e.target === node.id);
  const outgoingEdges = graph.edges.filter((e) => e.source === node.id);

  const incomingNodes = incomingEdges
    .map((e) => ({
      edge: e,
      node: graph.nodes.find((n) => n.id === e.source),
    }))
    .filter((x): x is { edge: typeof x.edge; node: GraphNode } => !!x.node);

  const outgoingNodes = outgoingEdges
    .map((e) => ({
      edge: e,
      node: graph.nodes.find((n) => n.id === e.target),
    }))
    .filter((x): x is { edge: typeof x.edge; node: GraphNode } => !!x.node);

  const handleCopy = () => {
    const text = `${node.file_path}#${node.symbol_name || node.label}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        bottom: '1rem',
        width: '380px',
        backgroundColor: '#FFFFFF',
        border: 'var(--border-thick)',
        boxShadow: 'var(--shadow-offset)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem',
          borderBottom: 'var(--border-thick)',
          backgroundColor: 'var(--color-paper)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-blue">{node.kind}</span>
            {node.is_hub && <span className="badge badge-coral">HUB</span>}
            <span className="badge">Degree: {node.degree}</span>
          </div>
          <h3
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.1rem',
              wordBreak: 'break-word',
            }}
          >
            {node.label}
          </h3>
        </div>

        <button
          onClick={onClose}
          style={{
            border: 'var(--border-thin)',
            background: 'none',
            cursor: 'pointer',
            padding: '0.2rem',
          }}
          aria-label="Close detail panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
        {/* Location Card */}
        <div
          style={{
            padding: '0.75rem',
            border: 'var(--border-thin)',
            backgroundColor: 'var(--color-paper)',
            marginBottom: '1rem',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ color: 'var(--color-ink-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
            SOURCE LOCATION
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: '0.25rem' }}>
            {node.file_path || 'unknown file'}
            {node.line_start ? ` : L${node.line_start}` : ''}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              className="badge"
              onClick={handleCopy}
              style={{ cursor: 'pointer' }}
              title="Copy file and symbol identifier"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy Ref'}
            </button>
            <button
              className="badge badge-coral"
              onClick={() => onCheckImpact(node.id)}
              style={{ cursor: 'pointer' }}
              title="Trace which components call this symbol"
            >
              <ShieldAlert size={12} />
              Trace Impact
            </button>
          </div>
        </div>

        {/* Incoming Callers */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 800,
              fontSize: '0.85rem',
              marginBottom: '0.5rem',
            }}
          >
            <ArrowDownRight size={16} color="var(--color-cobalt-blue)" />
            <span>INCOMING CONSUMERS ({incomingNodes.length})</span>
          </div>

          {incomingNodes.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
              No incoming callers indexed in this repository.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {incomingNodes.map(({ edge, node: inNode }) => (
                <div
                  key={edge.id}
                  onClick={() => onSelectNode(inNode)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    border: 'var(--border-thin)',
                    backgroundColor: '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-paper)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {inNode.label}
                  </span>
                  <span className="badge" style={{ fontSize: '0.65rem' }}>
                    {edge.relationship_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outgoing Calls */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 800,
              fontSize: '0.85rem',
              marginBottom: '0.5rem',
            }}
          >
            <ArrowUpRight size={16} color="var(--color-electric-lime)" />
            <span>OUTGOING CALLS & DEPS ({outgoingNodes.length})</span>
          </div>

          {outgoingNodes.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
              No outgoing dependencies indexed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {outgoingNodes.map(({ edge, node: outNode }) => (
                <div
                  key={edge.id}
                  onClick={() => onSelectNode(outNode)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    border: 'var(--border-thin)',
                    backgroundColor: '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-paper)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {outNode.label}
                  </span>
                  <span className="badge" style={{ fontSize: '0.65rem' }}>
                    {edge.relationship_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
