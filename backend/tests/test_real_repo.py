import httpx
import time

def test_real_repo():
    url = "https://github.com/bottlepy/bottle"
    print(f"Testing real GitHub repository: {url}")
    job_res = httpx.post(
        "http://127.0.0.1:8000/api/repositories",
        json={"url": url},
        timeout=15.0,
    ).json()
    print("Created Job:", job_res)
    job_id = job_res["job_id"]

    for i in range(40):
        time.sleep(2)
        status = httpx.get(f"http://127.0.0.1:8000/api/jobs/{job_id}").json()
        print(f"[{i*2}s] Stage: {status['stage']} ({status['progress']}%) - {status['message']}")
        if status["stage"] in ["ready", "failed"]:
            break

    if status["stage"] == "ready":
        repo_id = status["repository_id"]
        graph = httpx.get(f"http://127.0.0.1:8000/api/repositories/{repo_id}/graph").json()
        print("\n=== REAL EXTRACTION SUCCESSFUL! ===")
        print(f"Repository: {graph['owner']}/{graph['name']}")
        print(f"Total AST Nodes: {graph['statistics']['total_nodes']}")
        print(f"Total Connections: {graph['statistics']['total_edges']}")
        print(f"Total Files: {graph['statistics']['total_files']}")
        print(f"Architectural Hubs: {[h['label'] for h in graph['hub_nodes'][:5]]}")
        print("Sample nodes:", [f"{n['label']} ({n['kind']})" for n in graph['nodes'][:6]])
    else:
        print("Job failed with error:", status.get("error"))

if __name__ == "__main__":
    test_real_repo()
