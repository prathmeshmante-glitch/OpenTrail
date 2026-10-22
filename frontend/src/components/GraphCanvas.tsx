import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
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
import {
  Search,
  Filter,
  Route,
  RotateCcw,
  Share2,
  Map as MapIcon,
  Maximize2,
  Crosshair,
  Layers,
  Sparkles,
} from 'lucide-react';
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

type ViewMode = 'all' | 'overview';

const GraphCanvasInner: React.FC<GraphCanvasProps> = ({
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
  const { fitView, setCenter } = useReactFlow();
  const [searchTerm, setSearchTerm] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [relationFilter, setRelationFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');
  const [showMiniMap, setShowMiniMap] = useState<boolean>(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener ('/' to search, 'Escape' to reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  // Compute 2D Masonry Multi-Column Layout (eliminates horizontal card overlap & 1D overcrowding)
  const initialNodes: Node[] = useMemo(() => {
    // 1. Group nodes by community
    const communityGroups: Record<number, GraphNode[]> = {};
    graph.nodes.forEach((n) => {
      const comm = n.community ?? 0;
      if (!communityGroups[comm]) communityGroups[comm] = [];
      communityGroups[comm].push(n);
    });

    // 2. Sort communities by member count (largest first)
    const sortedCommunities = Object.entries(communityGroups).sort(
      ([, a], [, b]) => b.length - a.length
    );

    // 3. Multi-column masonry: 3 columns of communities
    const NUM_COLS = 3;
    const colHeights = new Array(NUM_COLS).fill(0);
    const CLUSTER_WIDTH = 620; // 2 cards of 240px + 40px spacing + padding
    const COL_GAP = 80;

    const calculated: Node[] = [];
    const isTrailActive = Boolean(executionTrail && executionTrail.steps.length > 0);

    sortedCommunities.forEach(([, members]) => {
      // Pick column with minimum cumulative height
      let targetCol = 0;
      let minHeight = colHeights[0];
      for (let c = 1; c < NUM_COLS; c++) {
        if (colHeights[c] < minHeight) {
          minHeight = colHeights[c];
          targetCol = c;
        }
      }

      const clusterBaseX = targetCol * (CLUSTER_WIDTH + COL_GAP) + 60;
      const clusterBaseY = colHeights[targetCol] + 60;

      // Sort nodes within community: hubs and classes first, then highest degree
      members.sort((a, b) => {
        if (a.is_hub && !b.is_hub) return -1;
        if (!a.is_hub && b.is_hub) return 1;
        if (a.kind === 'file' && b.kind !== 'file') return -1;
        if (a.kind !== 'file' && b.kind === 'file') return 1;
        return b.degree - a.degree;
      });

      // Place nodes in 2 columns inside the cluster: 240px wide cards with 280px step
      const CARD_STEP_X = 280;
      const CARD_STEP_Y = 150;

      members.forEach((n, idx) => {
        const subCol = idx % 2;
        const subRow = Math.floor(idx / 2);

        const x = clusterBaseX + subCol * CARD_STEP_X;
        const y = clusterBaseY + subRow * CARD_STEP_Y;

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

      const clusterRows = Math.ceil(members.length / 2);
      colHeights[targetCol] = clusterBaseY + clusterRows * CARD_STEP_Y + 70;
    });

    return calculated;
  }, [
    graph.nodes,
    highlightedNodeIds,
    impactedNodeIds,
    directImpactNodeIds,
    transitiveImpactNodeIds,
    selectedNode,
    executionTrail,
    trailStepMap,
  ]);

  // Edges mapping with relationship filter
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
          type: 'smoothstep',
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

  // Synchronize layout calculation
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Progressive exploration / Filter nodes based on viewMode, search, and kind
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const data = n.data as CustomNodeData;

      // If viewMode is 'overview', prioritize files, classes, tests, and hubs
      if (viewMode === 'overview') {
        const isArchitecturalAnchor =
          data.kind === 'file' ||
          data.kind === 'class' ||
          data.kind === 'test' ||
          data.is_hub ||
          data.isSelected ||
          data.isHighlighted ||
          data.isImpacted ||
          data.isTrailStep;
        if (!isArchitecturalAnchor) return false;
      }

      const matchesKind =
        kindFilter === 'all' ||
        (kindFilter === 'file' && data.kind === 'file') ||
        (kindFilter === 'class' && data.kind === 'class') ||
        (kindFilter === 'function' && (data.kind === 'function' || data.kind === 'method')) ||
        (kindFilter === 'module' && data.kind === 'module') ||
        (kindFilter === 'test' && data.kind === 'test');

      const matchesSearch =
        !searchTerm.trim() ||
        data.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        data.file_path.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesKind && matchesSearch;
    });
  }, [nodes, viewMode, kindFilter, searchTerm]);

  // Compute breakdown counts for filters (dynamic from nodes)
  const kindCounts = useMemo(() => {
    const counts = { all: nodes.length, file: 0, class: 0, function: 0, module: 0, test: 0 };
    nodes.forEach((n) => {
      const k = (n.data as CustomNodeData)?.kind;
      if (k === 'file') counts.file++;
      else if (k === 'class') counts.class++;
      else if (k === 'function' || k === 'method') counts.function++;
      else if (k === 'module') counts.module++;
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

  // Auto-center on selected node smoothly
  useEffect(() => {
    if (!selectedNode) return;
    const foundNode = nodes.find((n) => n.id === selectedNode.id);
    if (foundNode && foundNode.position) {
      setCenter(foundNode.position.x + 120, foundNode.position.y + 60, {
        zoom: 1.15,
        duration: 500,
      });
    }
  }, [selectedNode, nodes, setCenter]);

  const hasActiveFiltersOrHighlights =
    highlightedNodeIds.size > 0 ||
    impactedNodeIds.size > 0 ||
    Boolean(searchTerm) ||
    relationFilter !== 'all' ||
    kindFilter !== 'all' ||
    viewMode !== 'all' ||
    Boolean(pathSource) ||
    Boolean(pathTarget);

  const handleResetAll = useCallback(() => {
    setSearchTerm('');
    setKindFilter('all');
    setRelationFilter('all');
    setViewMode('all');
    setPathSource('');
    setPathTarget('');
    onResetHighlights();
    setTimeout(() => fitView({ padding: 0.15, duration: 500 }), 50);
  }, [onResetHighlights, fitView]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.15, duration: 600 });
  }, [fitView]);

  const handleCenterSelected = useCallback(() => {
    if (selectedNode) {
      const foundNode = nodes.find((n) => n.id === selectedNode.id);
      if (foundNode && foundNode.position) {
        setCenter(foundNode.position.x + 120, foundNode.position.y + 60, {
          zoom: 1.2,
          duration: 600,
        });
      }
    } else {
      fitView({ padding: 0.15, duration: 600 });
    }
  }, [selectedNode, nodes, setCenter, fitView]);

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
          gap: '0.45rem',
          flexWrap: 'wrap',
          backgroundColor: '#FFFFFF',
          border: 'var(--border-thick)',
          boxShadow: 'var(--shadow-offset)',
          padding: '0.45rem 0.65rem',
          maxWidth: 'calc(100% - 2rem)',
          alignItems: 'center',
        }}
      >
        {/* Symbol Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Search size={15} color="var(--color-ink-muted)" />
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
                const posNode = nodes.find((n) => n.id === filteredNodes[0].id);
                if (posNode) {
                  setCenter(posNode.position.x + 120, posNode.position.y + 60, {
                    zoom: 1.2,
                    duration: 500,
                  });
                }
              }
            }}
            style={{
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              width: '145px',
            }}
            title="Press '/' or Ctrl+K to search, Enter to focus first match, Esc to clear"
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

        <div style={{ width: '1px', backgroundColor: 'var(--color-border)', height: '20px', margin: '0 0.15rem' }} />

        {/* View Mode Toggle: Overview vs All */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <button
            className={`badge ${viewMode === 'all' ? 'badge-lime' : ''}`}
            onClick={() => setViewMode('all')}
            style={{ cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            title="View all 191 symbols in the repository"
          >
            <Layers size={11} /> All ({nodes.length})
          </button>
          <button
            className={`badge ${viewMode === 'overview' ? 'badge-blue' : ''}`}
            onClick={() => setViewMode('overview')}
            style={{ cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            title="Architecture Overview: Focus on Files, Classes, Tests, and Hubs"
          >
            <Sparkles size={11} /> Overview
          </button>
        </div>

        <div style={{ width: '1px', backgroundColor: 'var(--color-border)', height: '20px', margin: '0 0.15rem' }} />

        {/* Kind Filter (File, Class, Function, Module, Test) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <Filter size={13} />
          {(['file', 'class', 'function', 'module', 'test'] as const).map((k) => (
            <button
              key={k}
              className={`badge ${kindFilter === k ? 'badge-lime' : ''}`}
              onClick={() => setKindFilter(kindFilter === k ? 'all' : k)}
              style={{ cursor: 'pointer', textTransform: 'capitalize', fontSize: '0.7rem' }}
              title={`Filter by ${k} (${kindCounts[k]} nodes)`}
            >
              {k} <span style={{ opacity: 0.65, fontSize: '0.62rem' }}>({kindCounts[k]})</span>
            </button>
          ))}
        </div>

        <div style={{ width: '1px', backgroundColor: 'var(--color-border)', height: '20px', margin: '0 0.15rem' }} />

        {/* Relationship Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <Share2 size={13} />
          {(['calls', 'imports', 'contains'] as const).map((r) => (
            <button
              key={r}
              className={`badge ${relationFilter === r ? 'badge-blue' : ''}`}
              onClick={() => setRelationFilter(relationFilter === r ? 'all' : r)}
              style={{ cursor: 'pointer', textTransform: 'capitalize', fontSize: '0.68rem' }}
              title={`Filter by ${r} (${relationCounts[r]} relationships)`}
            >
              {r} <span style={{ opacity: 0.65, fontSize: '0.6rem' }}>({relationCounts[r]})</span>
            </button>
          ))}
        </div>

        <div style={{ width: '1px', backgroundColor: 'var(--color-border)', height: '20px', margin: '0 0.15rem' }} />

        {/* Shortest Path Helper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Route size={13} />
          <select
            value={pathSource}
            onChange={(e) => setPathSource(e.target.value)}
            style={{
              border: 'var(--border-thin)',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              padding: '0.15rem',
              maxWidth: '95px',
            }}
          >
            <option value="">Source...</option>
            {graph.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.75rem' }}>→</span>
          <select
            value={pathTarget}
            onChange={(e) => setPathTarget(e.target.value)}
            style={{
              border: 'var(--border-thin)',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              padding: '0.15rem',
              maxWidth: '95px',
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
            style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
          >
            Trace
          </button>
        </div>

        <div style={{ width: '1px', backgroundColor: 'var(--color-border)', height: '20px', margin: '0 0.15rem' }} />

        {/* Viewport Control Buttons: Fit View & Center */}
        <button
          className="btn"
          onClick={handleFitView}
          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
          title="Fit entire graph neatly into viewport"
        >
          <Maximize2 size={12} /> Fit
        </button>

        {selectedNode && (
          <button
            className="btn badge-lime"
            onClick={handleCenterSelected}
            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            title="Center canvas on currently selected node"
          >
            <Crosshair size={12} /> Center
          </button>
        )}

        <button
          className={`btn ${showMiniMap ? 'btn-secondary' : ''}`}
          onClick={() => setShowMiniMap(!showMiniMap)}
          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
          title={showMiniMap ? 'Hide overview minimap' : 'Show overview minimap'}
        >
          <MapIcon size={12} />
          {showMiniMap ? 'Minimap' : 'Map Off'}
        </button>

        {/* Filter State Status & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: filteredNodes.length < nodes.length ? 'var(--color-coral)' : 'var(--color-ink-muted)',
              fontWeight: 700,
            }}
          >
            {filteredNodes.length}/{nodes.length}
          </span>
          {hasActiveFiltersOrHighlights && (
            <button
              className="btn btn-secondary"
              onClick={handleResetAll}
              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              title="Reset all filters, highlights, and path tracing"
            >
              <RotateCcw size={11} /> Reset
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
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.1}
        maxZoom={2.5}
      >
        <Background color="#D3CDBC" gap={28} size={1.5} />
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
              if (n.data?.kind === 'file') return '#FFF8E1';
              return '#FFFFFF';
            }}
            style={{
              border: 'var(--border-thick)',
              boxShadow: 'var(--shadow-offset-sm)',
              borderRadius: 0,
              backgroundColor: '#FFFFFF',
              width: 200,
              height: 140,
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

export const GraphCanvas: React.FC<GraphCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
