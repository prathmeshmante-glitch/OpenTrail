import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Code, Box, FileText, CheckCircle, Route, Layers } from 'lucide-react';
import type { GraphNode } from '../types';

export interface CustomNodeData extends GraphNode {
  [key: string]: unknown;
  isHighlighted?: boolean;
  isImpacted?: boolean;
  isDirectImpact?: boolean;
  isTransitiveImpact?: boolean;
  isSelected?: boolean;
  isTrailStep?: boolean;
  trailStepNumber?: number;
  isDimmed?: boolean;
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
        return '#FFF8E1';
      case 'module':
        return '#E0E7FF';
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
      case 'module':
        return <Layers size={12} />;
      default:
        return <Code size={12} />;
    }
  };

  const isHighlighted = nodeData.isHighlighted || selected;
  const isDirectImpact = nodeData.isDirectImpact;
  const isTransitiveImpact = nodeData.isTransitiveImpact;
  const isTrailStep = nodeData.isTrailStep;
  const isDimmed = nodeData.isDimmed;

  // Background and border styling
  let bgColor = '#FFFFFF';
  let borderColor = 'var(--color-ink)';
  let borderStyle = 'solid';

  if (isTrailStep) {
    bgColor = 'var(--color-cobalt-blue)';
  } else if (isDirectImpact) {
    bgColor = 'var(--color-coral)';
    borderColor = '#B71C1C';
  } else if (isTransitiveImpact) {
    bgColor = '#FFE0B2';
    borderColor = '#E65100';
    borderStyle = 'dashed';
  } else if (isHighlighted) {
    bgColor = 'var(--color-electric-lime)';
  }

  return (
    <div
      style={{
        width: '240px',
        backgroundColor: bgColor,
        border: `2.5px ${borderStyle} ${borderColor}`,
        boxShadow: isHighlighted || isTrailStep ? '4px 4px 0px var(--color-ink)' : 'var(--shadow-offset-sm)',
        padding: '0.65rem 0.85rem',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        transform: isHighlighted || isTrailStep ? 'scale(1.03)' : 'none',
        opacity: isDimmed ? 0.25 : 1.0,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-ink)', width: 8, height: 8 }} />

      {/* Header with Kind, Trail Step, or Impact Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {isTrailStep && nodeData.trailStepNumber && (
            <span
              style={{
                backgroundColor: 'var(--color-electric-lime)',
                border: '1px solid var(--color-ink)',
                color: 'var(--color-ink)',
                fontWeight: 900,
                fontSize: '0.7rem',
                padding: '0.1rem 0.35rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <Route size={10} /> #{nodeData.trailStepNumber}
            </span>
          )}

          <div
            className="badge"
            style={{
              backgroundColor: isTrailStep ? '#FFFFFF' : getKindColor(nodeData.kind),
              color: 'var(--color-ink)',
              fontSize: '0.7rem',
              padding: '0.15rem 0.4rem',
            }}
          >
            {getKindIcon(nodeData.kind)}
            <span>{nodeData.kind}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {isDirectImpact && (
            <span className="badge badge-coral" style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem' }}>
              DIRECT
            </span>
          )}
          {isTransitiveImpact && (
            <span className="badge" style={{ fontSize: '0.6rem', padding: '0.05rem 0.3rem', backgroundColor: '#FFE082' }}>
              TRANSITIVE
            </span>
          )}
          {nodeData.is_hub && !isDirectImpact && !isTransitiveImpact && (
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
            style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem', backgroundColor: '#FFFFFF' }}
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
          lineHeight: 1.25,
          wordBreak: 'break-word',
          fontFamily: 'var(--font-mono)',
          marginBottom: '0.35rem',
          color: isTrailStep ? '#FFFFFF' : 'var(--color-ink)',
        }}
      >
        {nodeData.label}
      </div>

      {/* File & Line Location */}
      <div
        style={{
          fontSize: '0.75rem',
          color: isTrailStep ? 'rgba(255,255,255,0.9)' : 'var(--color-ink-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: isTrailStep ? '1px dashed rgba(255,255,255,0.4)' : '1px dashed rgba(34,34,34,0.3)',
          paddingTop: '0.3rem',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '130px',
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
