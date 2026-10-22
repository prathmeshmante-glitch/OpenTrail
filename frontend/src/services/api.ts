import type {
  HealthResponse,
  HubNode,
  InvestigationResponse,
  JobStatusResponse,
  RepositoryGraph,
  ShortestPathResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Request failed with status ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData.detail || errData.message || errMsg;
    } catch {
      // ignore json parse error
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<HealthResponse>(res);
  },

  async submitRepository(url: string): Promise<JobStatusResponse> {
    const res = await fetch(`${API_BASE}/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    return handleResponse<JobStatusResponse>(res);
  },

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    return handleResponse<JobStatusResponse>(res);
  },

  async getRepositoryGraph(repositoryId: string): Promise<RepositoryGraph> {
    const res = await fetch(`${API_BASE}/repositories/${repositoryId}/graph`);
    return handleResponse<RepositoryGraph>(res);
  },

  async getGodNodes(repositoryId: string): Promise<HubNode[]> {
    const res = await fetch(`${API_BASE}/repositories/${repositoryId}/god-nodes`);
    return handleResponse<HubNode[]>(res);
  },

  async getShortestPath(
    repositoryId: string,
    source: string,
    target: string
  ): Promise<ShortestPathResponse> {
    const params = new URLSearchParams({ source, target });
    const res = await fetch(`${API_BASE}/repositories/${repositoryId}/path?${params}`);
    return handleResponse<ShortestPathResponse>(res);
  },

  async getAffectedNodes(repositoryId: string, nodeId: string): Promise<string[]> {
    const params = new URLSearchParams({ node_id: nodeId });
    const res = await fetch(`${API_BASE}/repositories/${repositoryId}/affected?${params}`);
    return handleResponse<string[]>(res);
  },

  async createInvestigation(
    repositoryId: string,
    issueText: string,
    issueUrl?: string
  ): Promise<InvestigationResponse> {
    const res = await fetch(`${API_BASE}/repositories/${repositoryId}/investigations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue_text: issueText, issue_url: issueUrl || null }),
    });
    return handleResponse<InvestigationResponse>(res);
  },

  async getInvestigation(investigationId: string): Promise<InvestigationResponse> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}`);
    return handleResponse<InvestigationResponse>(res);
  },

  async simulateChangeImpact(
    repositoryId: string,
    nodeId: string,
    depth: number = 2
  ): Promise<import('../types').ImpactSimulationResponse> {
    const params = new URLSearchParams({ node_id: nodeId, depth: depth.toString() });
    const res = await fetch(`${API_BASE}/repositories/${repositoryId}/impact?${params}`);
    return handleResponse<import('../types').ImpactSimulationResponse>(res);
  },

  async getSmartTestMap(
    repositoryId: string,
    target?: string
  ): Promise<import('../types').TestMapResponse> {
    const params = target ? `?target=${encodeURIComponent(target)}` : '';
    const res = await fetch(`${API_BASE}/repositories/${repositoryId}/tests${params}`);
    return handleResponse<import('../types').TestMapResponse>(res);
  },

  async getExecutionTrail(
    repositoryId: string,
    startNodeId: string,
    endNodeId?: string,
    steps: number = 6
  ): Promise<import('../types').ExecutionTrailResponse> {
    const params = new URLSearchParams({ start: startNodeId, steps: steps.toString() });
    if (endNodeId) {
      params.append('end', endNodeId);
    }
    const res = await fetch(`${API_BASE}/repositories/${repositoryId}/trail?${params}`);
    return handleResponse<import('../types').ExecutionTrailResponse>(res);
  },

  async explainWhyThisFile(
    repositoryId: string,
    filePath: string,
    issueText?: string
  ): Promise<import('../types').WhyThisFileResponse> {
    const params = new URLSearchParams({ file_path: filePath });
    if (issueText) {
      params.append('issue_text', issueText);
    }
    const res = await fetch(`${API_BASE}/repositories/${repositoryId}/why-file?${params}`);
    return handleResponse<import('../types').WhyThisFileResponse>(res);
  },

  async generateFirstContributionPlan(
    repositoryId: string,
    issueText: string,
    issueUrl?: string
  ): Promise<import('../types').FirstContributionPlan> {
    const res = await fetch(`${API_BASE}/repositories/${repositoryId}/first-contribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue_text: issueText, issue_url: issueUrl || null }),
    });
    return handleResponse<import('../types').FirstContributionPlan>(res);
  },
};
