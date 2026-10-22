import { useState, useEffect, useCallback, useRef } from 'react';
import { TopNav } from './components/TopNav';
import { LandingHero } from './components/LandingHero';
import { ProcessingView } from './components/ProcessingView';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { GraphCanvas } from './components/GraphCanvas';
import { DetailPanel } from './components/DetailPanel';
import { IssueInvestigationModal } from './components/IssueInvestigationModal';
import { WhyThisFileModal } from './components/WhyThisFileModal';
import { TestMapModal } from './components/TestMapModal';
import { FirstContributionModal } from './components/FirstContributionModal';
import { ExecutionTrailBar } from './components/ExecutionTrailBar';
import { api } from './services/api';
import type {
  GraphNode,
  HealthResponse,
  InvestigationResponse,
  JobStatusResponse,
  RepositoryGraph,
  ImpactSimulationResponse,
  ExecutionTrailResponse,
} from './types';

export function App() {
  const [view, setView] = useState<'landing' | 'processing' | 'workspace'>('landing');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [currentJob, setCurrentJob] = useState<JobStatusResponse | null>(null);
  const [graph, setGraph] = useState<RepositoryGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [impactedNodeIds, setImpactedNodeIds] = useState<Set<string>>(new Set());
  const [directImpactNodeIds, setDirectImpactNodeIds] = useState<Set<string>>(new Set());
  const [transitiveImpactNodeIds, setTransitiveImpactNodeIds] = useState<Set<string>>(new Set());
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string>>(new Set());
  const [notification, setNotification] = useState<string | null>(null);

  // Investigation state
  const [isInvestigationOpen, setIsInvestigationOpen] = useState(false);
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [isInvestigating, setIsInvestigating] = useState(false);

  // Impact Simulation state
  const [impactResult, setImpactResult] = useState<ImpactSimulationResponse | null>(null);

  // Execution Trail state
  const [executionTrail, setExecutionTrail] = useState<ExecutionTrailResponse | null>(null);
  const [trailCurrentStepIndex, setTrailCurrentStepIndex] = useState(0);

  // Test Map state
  const [isTestMapOpen, setIsTestMapOpen] = useState(false);
  const [testMapTarget, setTestMapTarget] = useState<string | undefined>(undefined);

  // First Contribution state
  const [isFirstContributionOpen, setIsFirstContributionOpen] = useState(false);

  // Why This File state
  const [whyThisFileModalPath, setWhyThisFileModalPath] = useState<string | null>(null);

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
      setDirectImpactNodeIds(new Set());
      setTransitiveImpactNodeIds(new Set());
      setHighlightedEdgeIds(new Set());
      setImpactResult(null);
      setExecutionTrail(null);
      setView('workspace');
      setNotification('Loaded demonstration fixture: opentrail/sample');
    } catch (err: any) {
      alert(`Could not load demonstration sample: ${err.message}`);
    }
  };

  // Reset highlights and states
  const handleResetHighlights = useCallback(() => {
    setHighlightedNodeIds(new Set());
    setImpactedNodeIds(new Set());
    setDirectImpactNodeIds(new Set());
    setTransitiveImpactNodeIds(new Set());
    setHighlightedEdgeIds(new Set());
    setSelectedNode(null);
    setImpactResult(null);
    setExecutionTrail(null);
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

  // Simulate change impact (Feature Two)
  const handleSimulateImpact = async (nodeId: string, depth: number) => {
    if (!graph) return;
    try {
      const res = await api.simulateChangeImpact(graph.repository_id, nodeId, depth);
      setImpactResult(res);

      const direct = new Set<string>();
      const transitive = new Set<string>();
      res.impacted_nodes.forEach((n) => {
        if (n.is_direct) direct.add(n.node_id);
        else transitive.add(n.node_id);
      });

      setDirectImpactNodeIds(direct);
      setTransitiveImpactNodeIds(transitive);
      setImpactedNodeIds(new Set([...direct, ...transitive]));

      // Highlight edges involved in affected paths
      const edgeIds = new Set<string>();
      for (const path of res.affected_paths) {
        for (let i = 0; i < path.length - 1; i++) {
          const u = path[i];
          const v = path[i + 1];
          const edge = graph.edges.find(
            (e) => (e.source === u && e.target === v) || (e.source === v && e.target === u)
          );
          if (edge) edgeIds.add(edge.id);
        }
      }
      setHighlightedEdgeIds(edgeIds);
      setNotification(
        `Impact simulation complete: ${res.direct_impact_count} direct, ${res.transitive_impact_count} transitive dependent(s) up to ${depth} hop(s).`
      );
    } catch (err: any) {
      setNotification(`Impact simulation failed: ${err.message}`);
    }
  };

  // Clear impact simulation
  const handleClearImpact = () => {
    setImpactResult(null);
    setDirectImpactNodeIds(new Set());
    setTransitiveImpactNodeIds(new Set());
    setImpactedNodeIds(new Set());
    setHighlightedEdgeIds(new Set());
  };

  // Request execution trail (Feature Four)
  const handleRequestTrail = async (startNodeId: string, endNodeId?: string) => {
    if (!graph) return;
    try {
      const res = await api.getExecutionTrail(graph.repository_id, startNodeId, endNodeId, 6);
      setExecutionTrail(res);
      setTrailCurrentStepIndex(0);

      // Focus first step
      const firstStepNode = graph.nodes.find((n) => n.id === startNodeId);
      if (firstStepNode) setSelectedNode(firstStepNode);

      // Highlight trail nodes
      setHighlightedNodeIds(new Set(res.trail_path));

      // Highlight trail edges
      const edgeIds = new Set<string>();
      for (let i = 0; i < res.trail_path.length - 1; i++) {
        const u = res.trail_path[i];
        const v = res.trail_path[i + 1];
        const edge = graph.edges.find(
          (e) => (e.source === u && e.target === v) || (e.source === v && e.target === u)
        );
        if (edge) edgeIds.add(edge.id);
      }
      setHighlightedEdgeIds(edgeIds);
      setNotification(`Interactive Execution Trail active: ${res.total_hops} hops loaded.`);
    } catch (err: any) {
      setNotification(`Execution trail failed: ${err.message}`);
    }
  };

  // Stepper hop change for execution trail
  const handleTrailStepChange = (index: number) => {
    if (!executionTrail || !graph) return;
    setTrailCurrentStepIndex(index);
    const step = executionTrail.steps[index];
    if (step) {
      const node = graph.nodes.find((n) => n.id === step.node_id);
      if (node) setSelectedNode(node);
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

  // Focus a node from modals
  const handleFocusNode = (nodeId: string) => {
    if (!graph) return;
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
      setHighlightedNodeIds(new Set([nodeId]));
      const incidentEdges = new Set<string>();
      for (const edge of graph.edges) {
        if (edge.source === nodeId || edge.target === nodeId) {
          incidentEdges.add(edge.id);
        }
      }
      setHighlightedEdgeIds(incidentEdges);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopNav
        currentRepo={graph ? `${graph.owner}/${graph.name}` : null}
        onNewAnalysis={() => setView('landing')}
        onLoadSample={handleLoadSample}
        onOpenFirstContribution={() => setIsFirstContributionOpen(true)}
        onOpenTestMap={() => {
          setTestMapTarget(selectedNode?.symbol_name || undefined);
          setIsTestMapOpen(true);
        }}
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
            zIndex: 30,
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
              onOpenFirstContribution={() => setIsFirstContributionOpen(true)}
              onOpenTestMap={() => {
                setTestMapTarget(selectedNode?.symbol_name || undefined);
                setIsTestMapOpen(true);
              }}
            />

            {/* Central Graph Canvas */}
            <div style={{ flex: 1, height: '100%', position: 'relative' }}>
              <GraphCanvas
                graph={graph}
                selectedNode={selectedNode}
                onSelectNode={(node) => setSelectedNode(node)}
                highlightedNodeIds={highlightedNodeIds}
                impactedNodeIds={impactedNodeIds}
                directImpactNodeIds={directImpactNodeIds}
                transitiveImpactNodeIds={transitiveImpactNodeIds}
                highlightedEdgeIds={highlightedEdgeIds}
                onResetHighlights={handleResetHighlights}
                onRequestPath={handleRequestPath}
                executionTrail={executionTrail}
                trailCurrentStepIndex={trailCurrentStepIndex}
              />

              {/* Floating Execution Trail Stepper Bar (Feature Four) */}
              <ExecutionTrailBar
                trail={executionTrail}
                currentStepIndex={trailCurrentStepIndex}
                onStepChange={handleTrailStepChange}
                onReset={() => setExecutionTrail(null)}
              />

              {/* Contextual Detail Panel */}
              <DetailPanel
                node={selectedNode}
                graph={graph}
                onClose={() => setSelectedNode(null)}
                onSelectNode={(node) => setSelectedNode(node)}
                onCheckImpact={(nodeId) => handleSimulateImpact(nodeId, 2)}
                onSimulateImpact={handleSimulateImpact}
                onRequestTrail={(nodeId) => handleRequestTrail(nodeId)}
                onExplainFile={(filePath) => setWhyThisFileModalPath(filePath)}
                impactResult={impactResult}
                onClearImpact={handleClearImpact}
              />
            </div>

            {/* Issue Investigation Modal (Features One & Six) */}
            <IssueInvestigationModal
              isOpen={isInvestigationOpen}
              onClose={() => setIsInvestigationOpen(false)}
              onSubmitIssue={handleSubmitIssue}
              investigation={investigation}
              isLoading={isInvestigating}
              onHighlightComponents={(nodeIds) => {
                const nodeSet = new Set(nodeIds);
                setHighlightedNodeIds(nodeSet);

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
                handleFocusNode(nodeId);
                setIsInvestigationOpen(false);
              }}
              onExplainFile={(filePath) => setWhyThisFileModalPath(filePath)}
            />

            {/* Why This File Modal (Feature Six) */}
            {whyThisFileModalPath && (
              <WhyThisFileModal
                repositoryId={graph.repository_id}
                filePath={whyThisFileModalPath}
                issueText={investigation?.recommendations?.issue_summary}
                onClose={() => setWhyThisFileModalPath(null)}
                onSelectNode={(nodeId) => {
                  handleFocusNode(nodeId);
                  setWhyThisFileModalPath(null);
                }}
              />
            )}

            {/* Smart Regression Test Map Modal (Feature Three) */}
            {isTestMapOpen && (
              <TestMapModal
                isOpen={isTestMapOpen}
                repositoryId={graph.repository_id}
                initialTarget={testMapTarget}
                onClose={() => setIsTestMapOpen(false)}
                onSelectTestNode={(nodeId) => {
                  handleFocusNode(nodeId);
                  setIsTestMapOpen(false);
                }}
              />
            )}

            {/* First Contribution Mode Modal (Feature Five) */}
            {isFirstContributionOpen && (
              <FirstContributionModal
                isOpen={isFirstContributionOpen}
                repositoryId={graph.repository_id}
                onClose={() => setIsFirstContributionOpen(false)}
                onFocusNode={(nodeId) => handleFocusNode(nodeId)}
                onExplainFile={(filePath) => setWhyThisFileModalPath(filePath)}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
