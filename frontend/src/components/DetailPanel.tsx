import React, { useState } from 'react';
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
  Copy,
  Check,
  Route,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';
import type { GraphNode, RepositoryGraph, ImpactSimulationResponse } from '../types';

interface DetailPanelProps {
  node: GraphNode | null;
  graph: RepositoryGraph;
  onClose: () => void;
  onSelectNode: (node: GraphNode) => void;
  onCheckImpact: (nodeId: string) => void;
  onSimulateImpact?: (nodeId: string, depth: number) => void;
  onRequestTrail?: (nodeId: string) => void;
  onExplainFile?: (filePath: string) => void;
  impactResult?: ImpactSimulationResponse | null;
  onClearImpact?: () => void;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({
  node,
  graph,
  onClose,
  onSelectNode,
  onCheckImpact,
  onSimulateImpact,
  onRequestTrail,
  onExplainFile,
  impactResult,
  onClearImpact,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedDepth, setSelectedDepth] = useState<number>(2);
  const [isSimulating, setIsSimulating] = useState(false);

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

  const handleSimulate = async () => {
    if (onSimulateImpact) {
      setIsSimulating(true);
      try {
        await onSimulateImpact(node.id, selectedDepth);
      } finally {
        setIsSimulating(false);
      }
    } else {
      onCheckImpact(node.id);
    }
  };

  const allImpacted = Array.isArray(impactResult?.impacted_nodes) ? impactResult!.impacted_nodes : [];
  const directImpacts = allImpacted.filter((n) => n.is_direct ?? (n.distance === 1));
  const transitiveImpacts = allImpacted.filter((n) => !(n.is_direct ?? (n.distance === 1)));

  return (
    <div
      style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        bottom: '1rem',
        width: '400px',
        maxWidth: 'calc(100vw - 2rem)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            <span className="badge badge-blue">{node.kind}</span>
            {node.is_hub && <span className="badge badge-coral">HUB</span>}
            <span className="badge">Degree: {node.degree}</span>
          </div>
          <h3
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.05rem',
              wordBreak: 'break-word',
              margin: 0,
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
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginTop: '0.25rem', wordBreak: 'break-all' }}>
            {node.file_path || 'unknown file'}
            {node.line_start ? ` : L${node.line_start}` : ''}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="badge"
              onClick={handleCopy}
              style={{ cursor: 'pointer' }}
              title="Copy file and symbol identifier"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy Ref'}
            </button>
            {onExplainFile && node.file_path && (
              <button
                className="badge badge-lime"
                onClick={() => onExplainFile(node.file_path)}
                style={{ cursor: 'pointer' }}
                title="Explain why this file is relevant"
              >
                <HelpCircle size={12} />
                Why this file?
              </button>
            )}
            {onRequestTrail && (
              <button
                className="badge badge-blue"
                onClick={() => onRequestTrail(node.id)}
                style={{ cursor: 'pointer' }}
                title="Trace dependency execution trail from this node"
              >
                <Route size={12} />
                Trace Trail
              </button>
            )}
          </div>
        </div>

        {/* Change Impact Simulation Section */}
        <div
          style={{
            padding: '0.85rem',
            border: 'var(--border-thick)',
            backgroundColor: '#FFFFFF',
            boxShadow: 'var(--shadow-offset-sm)',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 800, fontSize: '0.85rem' }}>
              <ShieldAlert size={16} color="var(--color-coral)" />
              <span>CHANGE IMPACT SIMULATOR</span>
            </div>
            {impactResult && onClearImpact && (
              <button
                className="badge"
                onClick={onClearImpact}
                style={{ cursor: 'pointer', fontSize: '0.65rem' }}
                title="Clear simulation highlighting"
              >
                <RotateCcw size={10} /> Clear
              </button>
            )}
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)', margin: '0 0 0.5rem 0' }}>
            Inspects bounded AST callers, dependencies, and downstream consumers.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Depth:</span>
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                className={`badge ${selectedDepth === d ? 'badge-lime' : ''}`}
                onClick={() => setSelectedDepth(d)}
                style={{ cursor: 'pointer', padding: '0.15rem 0.4rem' }}
              >
                {d} {d === 1 ? 'hop' : 'hops'}
              </button>
            ))}
            <button
              className="btn btn-primary"
              onClick={handleSimulate}
              disabled={isSimulating}
              style={{ marginLeft: 'auto', padding: '0.25rem 0.65rem', fontSize: '0.75rem' }}
            >
              {isSimulating ? 'Simulating...' : 'Simulate'}
            </button>
          </div>

          {/* Simulation Output Display */}
          {impactResult && impactResult.target_node_id === node.id && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.4rem',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ padding: '0.4rem', backgroundColor: '#FFEBE8', border: '1px solid #FF8A65' }}>
                  <div style={{ color: 'var(--color-ink-muted)' }}>Direct Impact</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#B71C1C' }}>
                    {directImpacts.length}
                  </div>
                </div>
                <div style={{ padding: '0.4rem', backgroundColor: 'var(--color-paper)', border: '1px solid var(--color-ink)' }}>
                  <div style={{ color: 'var(--color-ink-muted)' }}>Transitive Impact</div>
                  <div style={{ fontWeight: 800, fontSize: '1rem' }}>
                    {transitiveImpacts.length}
                  </div>
                </div>
              </div>

              {/* Direct Impact Nodes */}
              {directImpacts.length > 0 && (
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    DIRECT CONSUMERS & CALLERS:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {directImpacts.slice(0, 5).map((n) => {
                      const rawNode = graph.nodes.find((gn) => gn.id === n.node_id);
                      return (
                        <div
                          key={n.node_id}
                          onClick={() => rawNode && onSelectNode(rawNode)}
                          style={{
                            padding: '0.3rem 0.5rem',
                            border: '1px solid var(--color-coral)',
                            backgroundColor: '#FFFFFF',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{n.label}</span>
                          <span className="badge badge-coral" style={{ fontSize: '0.65rem' }}>
                            {n.impact_type}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Transitive Impact Nodes with Breadcrumb Paths */}
              {transitiveImpacts.length > 0 && (
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    TRANSITIVE IMPACT PATHS:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {transitiveImpacts.slice(0, 4).map((n) => {
                      const rawNode = graph.nodes.find((gn) => gn.id === n.node_id);
                      return (
                        <div
                          key={n.node_id}
                          onClick={() => rawNode && onSelectNode(rawNode)}
                          style={{
                            padding: '0.3rem 0.5rem',
                            border: '1px dashed var(--color-ink)',
                            backgroundColor: 'var(--color-paper)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{n.label}</span>
                            <span className="badge" style={{ fontSize: '0.6rem' }}>dist: {n.distance}</span>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
                            {n.path_from_target.join(' → ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Candidate Tests */}
              {impactResult.candidate_tests.length > 0 && (
                <div style={{ padding: '0.4rem 0.6rem', backgroundColor: '#FFFDF0', border: '1px solid #FFE082', fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Candidate Regression Tests:</div>
                  {impactResult.candidate_tests.map((t, i) => (
                    <div key={i} style={{ fontFamily: 'var(--font-mono)' }}>• {t}</div>
                  ))}
                </div>
              )}

              {/* Summary Caveats */}
              {impactResult.summary_caveats.length > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
                  {impactResult.summary_caveats[0]}
                </div>
              )}
            </div>
          )}
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
