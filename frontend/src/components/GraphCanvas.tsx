import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Search, Filter, Route, RotateCcw } from 'lucide-react';
import { CustomNode } from './CustomNode';
import type { CustomNodeData } from './CustomNode';
import type { GraphNode, RepositoryGraph } from '../types';

interface GraphCanvasProps {
  graph: RepositoryGraph;
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
  highlightedNodeIds: Set<string>;
  impactedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  onResetHighlights: () => void;
  onRequestPath: (sourceId: string, targetId: string) => void;
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
  highlightedEdgeIds,
  onResetHighlights,
  onRequestPath,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [pathSource, setPathSource] = useState<string>('');
  const [pathTarget, setPathTarget] = useState<string>('');

  // Compute layout positions deterministically
  const initialNodes: Node[] = useMemo(() => {
    // Group nodes by community or file for layout
    const communityGroups: Record<number, GraphNode[]> = {};
    graph.nodes.forEach((n) => {
      const comm = n.community ?? 0;
      communityGroups[comm] = communityGroups[comm] || [];
      communityGroups[comm].push(n);
    });

    const calculated: Node[] = [];
    let colOffset = 0;

    Object.values(communityGroups).forEach((members) => {
      members.sort((a, b) => b.degree - a.degree);
      members.forEach((n, idx) => {
        const x = colOffset * 320 + (idx % 2) * 160;
        const y = Math.floor(idx / 2) * 160;
        const nodeData: CustomNodeData = {
          ...n,
          isHighlighted: highlightedNodeIds.has(n.id) || selectedNode?.id === n.id,
          isImpacted: impactedNodeIds.has(n.id),
          isSelected: selectedNode?.id === n.id,
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
  }, [graph, highlightedNodeIds, impactedNodeIds, selectedNode]);

  const initialEdges: Edge[] = useMemo(() => {
    return graph.edges.map((e) => {
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
          strokeWidth: isHighlighted ? 3 : 2,
          stroke: isHighlighted ? 'var(--color-electric-lime)' : 'var(--color-ink)',
        },
      };
    });
  }, [graph.edges, highlightedEdgeIds]);

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
      {/* Search & Filter Toolbar */}
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
            type="text"
            placeholder="Search symbol or file..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              width: '180px',
            }}
          />
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
              style={{ cursor: 'pointer', textTransform: 'capitalize' }}
            >
              {k}
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
              maxWidth: '120px',
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
              maxWidth: '120px',
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

        {(highlightedNodeIds.size > 0 || searchTerm) && (
          <button
            className="btn"
            onClick={() => {
              setSearchTerm('');
              onResetHighlights();
            }}
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            title="Reset highlight and filters"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        )}
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
        minZoom={0.2}
        maxZoom={2.5}
      >
        <Background color="#D3CDBC" gap={20} size={1.5} />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          nodeColor={(n: any) => {
            if (n.data?.isImpacted) return 'var(--color-coral)';
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
      </ReactFlow>
    </div>
  );
};
