import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Code, Box, FileText, CheckCircle } from 'lucide-react';
import type { GraphNode } from '../types';

export interface CustomNodeData extends GraphNode {
  [key: string]: unknown;
  isHighlighted?: boolean;
  isImpacted?: boolean;
  isSelected?: boolean;
}

const CustomNodeComponent: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const nodeData = data as CustomNodeData;

  const getKindColor = (kind: string) => {
    switch (kind) {
      case 'class':
        return 'var(--color-cobalt-blue)';
      case 'function':
      case 'method':
        return 'var(--color-electric-lime)';
      case 'test':
        return 'var(--color-coral)';
      case 'file':
        return 'var(--color-paper)';
      default:
        return '#FFFFFF';
    }
  };

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'class':
        return <Box size={12} />;
      case 'function':
      case 'method':
        return <Code size={12} />;
      case 'test':
        return <CheckCircle size={12} />;
      case 'file':
        return <FileText size={12} />;
      default:
        return <Code size={12} />;
    }
  };

  const isHighlighted = nodeData.isHighlighted || selected;
  const isImpacted = nodeData.isImpacted;

  return (
    <div
      style={{
        minWidth: '180px',
        maxWidth: '240px',
        backgroundColor: isImpacted
          ? 'var(--color-coral)'
          : isHighlighted
          ? 'var(--color-electric-lime)'
          : '#FFFFFF',
        border: 'var(--border-thick)',
        boxShadow: isHighlighted ? '4px 4px 0px var(--color-ink)' : 'var(--shadow-offset-sm)',
        padding: '0.65rem 0.85rem',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        transform: isHighlighted ? 'scale(1.03)' : 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-ink)', width: 8, height: 8 }} />

      {/* Header with Kind & Degree */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.4rem',
        }}
      >
        <div
          className="badge"
          style={{
            backgroundColor: getKindColor(nodeData.kind),
            fontSize: '0.7rem',
            padding: '0.15rem 0.4rem',
          }}
        >
          {getKindIcon(nodeData.kind)}
          <span>{nodeData.kind}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {nodeData.is_hub && (
            <span
              className="badge badge-coral"
              title="Architectural Hub (High connectivity)"
              style={{ padding: '0.1rem 0.3rem', fontSize: '0.65rem' }}
            >
              HUB
            </span>
          )}
          <span
            className="badge"
            title={`Connections: ${nodeData.degree}`}
            style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem' }}
          >
            d:{nodeData.degree}
          </span>
        </div>
      </div>

      {/* Symbol Label */}
      <div
        style={{
          fontWeight: 800,
          fontSize: '0.9rem',
          lineHeight: 1.2,
          wordBreak: 'break-word',
          fontFamily: 'var(--font-mono)',
          marginBottom: '0.35rem',
        }}
      >
        {nodeData.label}
      </div>

      {/* File & Line Location */}
      <div
        style={{
          fontSize: '0.75rem',
          color: isImpacted || isHighlighted ? 'var(--color-ink)' : 'var(--color-ink-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px dashed rgba(34,34,34,0.3)',
          paddingTop: '0.3rem',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '120px',
          }}
          title={nodeData.file_path}
        >
          {nodeData.file_path || 'root'}
        </span>
        {nodeData.line_start && (
          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
            L{nodeData.line_start}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-ink)', width: 8, height: 8 }} />
    </div>
  );
};

export const CustomNode = memo(CustomNodeComponent);
