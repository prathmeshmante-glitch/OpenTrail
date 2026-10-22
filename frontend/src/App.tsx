import { useState, useEffect, useCallback, useRef } from 'react';
import { TopNav } from './components/TopNav';
import { LandingHero } from './components/LandingHero';
import { ProcessingView } from './components/ProcessingView';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { GraphCanvas } from './components/GraphCanvas';
import { DetailPanel } from './components/DetailPanel';
import { IssueInvestigationModal } from './components/IssueInvestigationModal';
import { api } from './services/api';
import type {
  GraphNode,
  HealthResponse,
  InvestigationResponse,
  JobStatusResponse,
  RepositoryGraph,
} from './types';

export function App() {
  const [view, setView] = useState<'landing' | 'processing' | 'workspace'>('landing');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [currentJob, setCurrentJob] = useState<JobStatusResponse | null>(null);
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [impactedNodeIds, setImpactedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);

  // Investigation state
  const [isInvestigationOpen, setIsInvestigationOpen] = useState(false);
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [isInvestigating, setIsInvestigating] = useState(false);

  // Poll timer ref
  const pollTimerRef = useRef<number | null>(null);

  // Check health on load
  useEffect(() => {
    api.getHealth()
      .then(setHealth)
      .catch((err) => console.warn('Could not fetch backend health:', err));
  }, []);

  // Poll for job completion when in processing view
  useEffect(() => {
    if (view !== 'processing' || !currentJob?.job_id) return;

    const checkJob = async () => {
      try {
        const updated = await api.getJobStatus(currentJob.job_id);
        setCurrentJob(updated);

        if (updated.stage === 'ready' && updated.repository_id) {
          const fetchedGraph = await api.getRepositoryGraph(updated.repository_id);
          setGraph(fetchedGraph);
          setView('workspace');
          setNotification(`Successfully analyzed ${fetchedGraph.owner}/${fetchedGraph.name}`);
        } else if (updated.stage === 'failed') {
          // Stay on processing view to show failure
        } else {
          // Schedule next poll
          pollTimerRef.current = window.setTimeout(checkJob, 1500);
        }
      } catch (err: any) {
        console.error('Job polling error:', err);
      }
    };

    pollTimerRef.current = window.setTimeout(checkJob, 1500);

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [view, currentJob]);

  // Handle repository submission from Landing
  const handleSubmitRepo = async (url: string) => {
    try {
      const job = await api.submitRepository(url);
      setCurrentJob(job);
      setView('processing');
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    }
  };

  // Load preloaded demonstration sample repo immediately
  const handleLoadSample = async () => {
    try {
      const sampleGraph = await api.getRepositoryGraph('opentrail_sample');
      setGraph(sampleGraph);
      setSelectedNode(null);
      setHighlightedNodeIds(new Set());
      setImpactedNodeIds(new Set());
      setHighlightedEdgeIds(new Set());
      setView('workspace');
      setNotification('Loaded demonstration fixture: opentrail/sample');
    } catch (err: any) {
      alert(`Could not load demonstration sample: ${err.message}`);
    }
  };

  // Reset highlights
  const handleResetHighlights = useCallback(() => {
    setHighlightedNodeIds(new Set());
    setImpactedNodeIds(new Set());
    setHighlightedEdgeIds(new Set());
    setSelectedNode(null);
    setNotification(null);
  }, []);

  // Request shortest path
  const handleRequestPath = async (sourceId: string, targetId: string) => {
    if (!graph) return;
    try {
      const pathRes = await api.getShortestPath(graph.repository_id, sourceId, targetId);
      setNotification(pathRes.formatted_explanation);
      if (pathRes.path_nodes.length > 0) {
        setHighlightedNodeIds(new Set(pathRes.path_nodes));
      }
    } catch (err: any) {
      setNotification(`Path search failed: ${err.message}`);
    }
  };

  // Check downstream impact
  const handleCheckImpact = async (nodeId: string) => {
    if (!graph) return;
    try {
      const affected = await api.getAffectedNodes(graph.repository_id, nodeId);
      setImpactedNodeIds(new Set(affected));
      setNotification(`Identified ${affected.length} downstream component(s) impacted by ${nodeId}`);
    } catch (err: any) {
      setNotification(`Impact check failed: ${err.message}`);
    }
  };

  // Submit issue for Gemma 4 investigation
  const handleSubmitIssue = async (issueText: string, issueUrl?: string) => {
    if (!graph) return;
    setIsInvestigating(true);
    try {
      const res = await api.createInvestigation(graph.repository_id, issueText, issueUrl);
      setInvestigation(res);
      if (res.recommendations?.relevant_components) {
        const verifiedComps = res.recommendations.relevant_components
          .filter((c) => c.is_verified)
          .map((c) => c.node_id);
        const compIds =
          verifiedComps.length > 0
            ? verifiedComps
            : res.recommendations.relevant_components.map((c) => c.node_id);
        const nodeSet = new Set(compIds);
        setHighlightedNodeIds(nodeSet);

        // Compute actual connecting edges between validated nodes
        const edgeIds = new Set<string>();
        if (graph.edges) {
          for (const edge of graph.edges) {
            if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
              edgeIds.add(edge.id);
            }
          }
        }
        setHighlightedEdgeIds(edgeIds);
      }
    } catch (err: any) {
      alert(`Investigation failed: ${err.message}`);
    } finally {
      setIsInvestigating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopNav
        currentRepo={graph ? `${graph.owner}/${graph.name}` : null}
        onNewAnalysis={() => setView('landing')}
        onLoadSample={handleLoadSample}
        health={health}
      />

      {/* Notification banner */}
      {notification && (
        <div
          style={{
            backgroundColor: 'var(--color-electric-lime)',
            borderBottom: 'var(--border-thick)',
            padding: '0.4rem 1.5rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '1rem',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main View Router */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {view === 'landing' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <LandingHero
              onSubmit={handleSubmitRepo}
              isLoading={false}
              onLoadSample={handleLoadSample}
            />
          </div>
        )}

        {view === 'processing' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <ProcessingView
              job={currentJob}
              onCancel={() => setView('landing')}
            />
          </div>
        )}

        {view === 'workspace' && graph && (
          <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
            {/* Left Sidebar */}
            <WorkspaceSidebar
              graph={graph}
              onSelectNode={(node) => setSelectedNode(node)}
              onOpenInvestigation={() => setIsInvestigationOpen(true)}
            />

            {/* Central Graph Canvas */}
            <div style={{ flex: 1, height: '100%', position: 'relative' }}>
              <GraphCanvas
                graph={graph}
                selectedNode={selectedNode}
                onSelectNode={(node) => setSelectedNode(node)}
                highlightedNodeIds={highlightedNodeIds}
                impactedNodeIds={impactedNodeIds}
                highlightedEdgeIds={highlightedEdgeIds}
                onResetHighlights={handleResetHighlights}
                onRequestPath={handleRequestPath}
              />

              {/* Contextual Detail Panel */}
              <DetailPanel
                node={selectedNode}
                graph={graph}
                onClose={() => setSelectedNode(null)}
                onSelectNode={(node) => setSelectedNode(node)}
                onCheckImpact={handleCheckImpact}
              />
            </div>

            {/* Issue Investigation Modal */}
            <IssueInvestigationModal
              isOpen={isInvestigationOpen}
              onClose={() => setIsInvestigationOpen(false)}
              onSubmitIssue={handleSubmitIssue}
              investigation={investigation}
              isLoading={isInvestigating}
              onHighlightComponents={(nodeIds) => {
                const nodeSet = new Set(nodeIds);
                setHighlightedNodeIds(nodeSet);

                // Highlight actual edges connecting these nodes
                const edgeIds = new Set<string>();
                if (graph?.edges) {
                  for (const edge of graph.edges) {
                    if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
                      edgeIds.add(edge.id);
                    }
                  }
                }
                setHighlightedEdgeIds(edgeIds);
                setIsInvestigationOpen(false);
              }}
              onSelectComponent={(nodeId) => {
                const node = graph.nodes.find((n) => n.id === nodeId);
                if (node) {
                  setSelectedNode(node);
                  setHighlightedNodeIds(new Set([nodeId]));
                  const incidentEdges = new Set<string>();
                  if (graph.edges) {
                    for (const edge of graph.edges) {
                      if (edge.source === nodeId || edge.target === nodeId) {
                        incidentEdges.add(edge.id);
                      }
                    }
                  }
                  setHighlightedEdgeIds(incidentEdges);
                }
                setIsInvestigationOpen(false);
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
