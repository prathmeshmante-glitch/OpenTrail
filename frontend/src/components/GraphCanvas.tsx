import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Search, Filter, Route, RotateCcw, Share2, Map as MapIcon } from 'lucide-react';
import { CustomNode } from './CustomNode';
import type { CustomNodeData } from './CustomNode';
import type { GraphNode, RepositoryGraph, ExecutionTrailResponse } from '../types';

interface GraphCanvasProps {
  graph: RepositoryGraph;
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
  highlightedNodeIds: Set<string>;
  impactedNodeIds: Set<string>;
  directImpactNodeIds?: Set<string>;
  transitiveImpactNodeIds?: Set<string>;
  highlightedEdgeIds: Set<string>;
  onResetHighlights: () => void;
  onRequestPath: (sourceId: string, targetId: string) => void;
  executionTrail?: ExecutionTrailResponse | null;
  trailCurrentStepIndex?: number;
}

const nodeTypes = {
  customNode: CustomNode,
};

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graph,
  selectedNode,
  onSelectNode,
  highlightedNodeIds,
  impactedNodeIds,
  directImpactNodeIds = new Set(),
  transitiveImpactNodeIds = new Set(),
  highlightedEdgeIds,
  onResetHighlights,
  onRequestPath,
  executionTrail,
  trailCurrentStepIndex: _trailCurrentStepIndex = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [relationFilter, setRelationFilter] = useState<string>('all');
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');
  const [showMiniMap, setShowMiniMap] = useState<boolean>(true);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Global keyboard shortcuts: '/' or Ctrl+K to search, Escape to reset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in another input/textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea';

      if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape') {
        searchInputRef.current?.blur();
        setSearchTerm('');
        onResetHighlights();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResetHighlights]);

  // Map trail steps for quick node lookup
  const trailStepMap = useMemo(() => {
    const map = new Map<string, number>();
    if (executionTrail) {
      executionTrail.steps.forEach((st) => {
        map.set(st.node_id, st.step_number);
      });
    }
    return map;
  }, [executionTrail]);

  // Compute layout positions deterministically with clean spacing
  const initialNodes: Node[] = useMemo(() => {
    // Group nodes by community for structured clustering
    const communityGroups: Record<number, GraphNode[]> = {};
    graph.nodes.forEach((n) => {
      const comm = n.community ?? 0;
      communityGroups[comm] = communityGroups[comm] || [];
      communityGroups[comm].push(n);
    });

    const calculated: Node[] = [];
    let colOffset = 0;

    const isTrailActive = Boolean(executionTrail && executionTrail.steps.length > 0);

    Object.values(communityGroups).forEach((members) => {
      members.sort((a, b) => b.degree - a.degree);

      members.forEach((n, idx) => {
        // Staggered grid spacing to completely prevent overlapping
        const x = colOffset * 380 + (idx % 2) * 190;
        const y = Math.floor(idx / 2) * 180 + (idx % 2 === 1 ? 30 : 0);

        const isTrailStep = trailStepMap.has(n.id);
        const trailStepNumber = trailStepMap.get(n.id);
        const isDimmed = isTrailActive && !isTrailStep;

        const nodeData: CustomNodeData = {
          ...n,
          isHighlighted: highlightedNodeIds.has(n.id) || selectedNode?.id === n.id,
          isImpacted: impactedNodeIds.has(n.id),
          isDirectImpact: directImpactNodeIds.has(n.id),
          isTransitiveImpact: transitiveImpactNodeIds.has(n.id),
          isSelected: selectedNode?.id === n.id,
          isTrailStep,
          trailStepNumber,
          isDimmed,
        };

        calculated.push({
          id: n.id,
          type: 'customNode',
          position: { x, y },
          data: nodeData,
        });
      });
      colOffset += 1;
    });

    return calculated;
  }, [
    graph,
    highlightedNodeIds,
    impactedNodeIds,
    directImpactNodeIds,
    transitiveImpactNodeIds,
    selectedNode,
    executionTrail,
    trailStepMap,
  ]);

  const initialEdges: Edge[] = useMemo(() => {
    return graph.edges
      .filter((e) => {
        if (relationFilter === 'all') return true;
        return e.relationship_type.toLowerCase() === relationFilter.toLowerCase();
      })
      .map((e) => {
        const isHighlighted = highlightedEdgeIds.has(e.id);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: isHighlighted || e.confidence === 'INFERRED',
          className: isHighlighted ? 'highlighted' : e.confidence === 'INFERRED' ? 'inferred' : '',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isHighlighted ? 'var(--color-electric-lime)' : 'var(--color-ink)',
          },
          style: {
            strokeWidth: isHighlighted ? 3.5 : 1.8,
            stroke: isHighlighted ? 'var(--color-electric-lime)' : 'var(--color-ink)',
          },
        };
      });
  }, [graph.edges, highlightedEdgeIds, relationFilter]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state updates
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Filter nodes based on search & kind
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const data = n.data as CustomNodeData;
      const matchesKind =
        kindFilter === 'all' ||
        (kindFilter === 'class' && data.kind === 'class') ||
        (kindFilter === 'function' && (data.kind === 'function' || data.kind === 'method')) ||
        (kindFilter === 'file' && data.kind === 'file') ||
        (kindFilter === 'test' && data.kind === 'test');

      const matchesSearch =
        !searchTerm.trim() ||
        data.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.file_path.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesKind && matchesSearch;
    });
  }, [nodes, kindFilter, searchTerm]);

  // Compute breakdown counts for filters
  const kindCounts = useMemo(() => {
    const counts = { all: nodes.length, class: 0, function: 0, file: 0, test: 0 };
    nodes.forEach((n) => {
      const k = (n.data as CustomNodeData)?.kind;
      if (k === 'class') counts.class++;
      else if (k === 'function' || k === 'method') counts.function++;
      else if (k === 'file') counts.file++;
      else if (k === 'test') counts.test++;
    });
    return counts;
  }, [nodes]);

  const relationCounts = useMemo(() => {
    const counts = { all: graph.edges.length, calls: 0, imports: 0, contains: 0 };
    graph.edges.forEach((e) => {
      const rt = e.relationship_type.toLowerCase();
      if (rt === 'calls') counts.calls++;
      else if (rt === 'imports') counts.imports++;
      else if (rt === 'contains') counts.contains++;
    });
    return counts;
  }, [graph.edges]);

  const hasActiveFiltersOrHighlights =
    highlightedNodeIds.size > 0 ||
    impactedNodeIds.size > 0 ||
    Boolean(searchTerm) ||
    relationFilter !== 'all' ||
    kindFilter !== 'all' ||
    Boolean(pathSource) ||
    Boolean(pathTarget);

  const handleResetAll = useCallback(() => {
    setSearchTerm('');
    setKindFilter('all');
    setRelationFilter('all');
    setPathSource('');
    setPathTarget('');
    onResetHighlights();
  }, [onResetHighlights]);

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      const rawNode = graph.nodes.find((n) => n.id === node.id) || null;
      onSelectNode(rawNode);
    },
    [graph.nodes, onSelectNode]
  );

  const handleComputePath = () => {
    if (pathSource && pathTarget && pathSource !== pathTarget) {
      onRequestPath(pathSource, pathTarget);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Search, Filter & Relationship Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          zIndex: 10,
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          backgroundColor: '#FFFFFF',
          border: 'var(--border-thick)',
          boxShadow: 'var(--shadow-offset)',
          padding: '0.5rem 0.75rem',
          maxWidth: 'calc(100% - 2rem)',
        }}
      >
        {/* Symbol Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Search size={16} color="var(--color-ink-muted)" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search (/ to focus)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredNodes.length > 0) {
                const targetNode = graph.nodes.find((n) => n.id === filteredNodes[0].id) || null;
                onSelectNode(targetNode);
              }
            }}
            style={{
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              width: '160px',
            }}
            title="Press '/' or Ctrl+K to search, Enter to select first match, Esc to clear"
          />
          {searchTerm.trim() && (
            <span
              className="badge badge-lime"
              style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}
            >
              {filteredNodes.length} match{filteredNodes.length === 1 ? '' : 'es'}
            </span>
          )}
        </div>

        <div style={{ width: '1px', backgroundColor: 'var(--color-border)', margin: '0 0.25rem' }} />

        {/* Kind Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Filter size={14} />
          {(['all', 'class', 'function', 'file', 'test'] as const).map((k) => (
            <button
              key={k}
              className={`badge ${kindFilter === k ? 'badge-lime' : ''}`}
              onClick={() => setKindFilter(k)}
              style={{ cursor: 'pointer', textTransform: 'capitalize', fontSize: '0.72rem' }}
              title={`Filter by ${k} (${kindCounts[k]} nodes)`}
            >
              {k} <span style={{ opacity: 0.65, fontSize: '0.62rem' }}>({kindCounts[k]})</span>
            </button>
          ))}
        </div>

        <div style={{ width: '1px', backgroundColor: 'var(--color-border)', margin: '0 0.25rem' }} />

        {/* Relationship Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Share2 size={14} />
          {(['all', 'calls', 'imports', 'contains'] as const).map((r) => (
            <button
              key={r}
              className={`badge ${relationFilter === r ? 'badge-blue' : ''}`}
              onClick={() => setRelationFilter(r)}
              style={{ cursor: 'pointer', textTransform: 'capitalize', fontSize: '0.7rem' }}
              title={`Filter by ${r} (${relationCounts[r]} relationships)`}
            >
              {r} <span style={{ opacity: 0.65, fontSize: '0.62rem' }}>({relationCounts[r]})</span>
            </button>
          ))}
        </div>

        <div style={{ width: '1px', backgroundColor: 'var(--color-border)', margin: '0 0.25rem' }} />

        {/* Shortest Path Helper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Route size={14} />
          <select
            value={pathSource}
            onChange={(e) => setPathSource(e.target.value)}
            style={{
              border: 'var(--border-thin)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              padding: '0.2rem',
              maxWidth: '110px',
            }}
          >
            <option value="">Source...</option>
            {graph.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.8rem' }}>→</span>
          <select
            value={pathTarget}
            onChange={(e) => setPathTarget(e.target.value)}
            style={{
              border: 'var(--border-thin)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              padding: '0.2rem',
              maxWidth: '110px',
            }}
          >
            <option value="">Target...</option>
            {graph.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={handleComputePath}
            disabled={!pathSource || !pathTarget}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
          >
            Trace
          </button>
        </div>

        <button
          className={`btn ${showMiniMap ? 'btn-secondary' : ''}`}
          onClick={() => setShowMiniMap(!showMiniMap)}
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          title={showMiniMap ? 'Hide overview minimap' : 'Show overview minimap'}
        >
          <MapIcon size={12} />
          {showMiniMap ? 'Minimap On' : 'Minimap Off'}
        </button>

        {/* Filter State Status & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: filteredNodes.length < nodes.length ? 'var(--color-coral)' : 'var(--color-ink-muted)',
              fontWeight: 600,
            }}
          >
            {filteredNodes.length}/{nodes.length} nodes
          </span>
          {hasActiveFiltersOrHighlights && (
            <button
              className="btn btn-secondary"
              onClick={handleResetAll}
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              title="Reset all filters, highlights, and path tracing"
            >
              <RotateCcw size={12} />
              Reset All
            </button>
          )}
        </div>
      </div>

      {/* Main React Flow Canvas */}
      <ReactFlow
        nodes={filteredNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes as any}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.15}
        maxZoom={2.5}
      >
        <Background color="#D3CDBC" gap={24} size={1.5} />
        <Controls position="bottom-left" showInteractive={false} />
        {showMiniMap ? (
          <MiniMap
            position="bottom-right"
            nodeColor={(n: any) => {
              if (n.data?.isDirectImpact) return 'var(--color-coral)';
              if (n.data?.isTransitiveImpact) return '#FFA726';
              if (n.data?.isTrailStep) return 'var(--color-cobalt-blue)';
              if (n.data?.isHighlighted) return 'var(--color-electric-lime)';
              if (n.data?.kind === 'class') return 'var(--color-cobalt-blue)';
              return '#FFFFFF';
            }}
            style={{
              border: 'var(--border-thick)',
              boxShadow: 'var(--shadow-offset-sm)',
              borderRadius: 0,
              backgroundColor: '#FFFFFF',
            }}
          />
        ) : (
          <Panel position="bottom-right">
            <button
              className="btn btn-secondary"
              onClick={() => setShowMiniMap(true)}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'var(--color-paper)',
              }}
              title="Expand overview minimap"
            >
              <MapIcon size={13} />
              Show Minimap
            </button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
};
