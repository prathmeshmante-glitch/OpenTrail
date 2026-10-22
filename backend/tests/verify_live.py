import httpx
import time

def verify_live():
    print("--- 1. Testing Health Endpoint ---")
    health = httpx.get("http://127.0.0.1:8000/api/health").json()
    print("Health Status:", health)

    print("\n--- 2. Testing Sample Graph Endpoint ---")
    graph = httpx.get("http://127.0.0.1:8000/api/repositories/opentrail_sample/graph").json()
    print("Repository:", graph["owner"], "/", graph["name"])
    print("Nodes count:", len(graph["nodes"]))
    print("Edges count:", len(graph["edges"]))
    print("Hubs:", [h["label"] for h in graph["hub_nodes"]])

    print("\n--- 3. Testing Shortest Path ---")
    path = httpx.get(
        "http://127.0.0.1:8000/api/repositories/opentrail_sample/path",
        params={"source": "main_main", "target": "processor_calculate_metrics"},
    ).json()
    print("Path result:", path["formatted_explanation"])

    print("\n--- 4. Testing Grounded Issue Investigation ---")
    inv = httpx.post(
        "http://127.0.0.1:8000/api/repositories/opentrail_sample/investigations",
        json={"issue_text": "MetricProcessor fails to calculate metrics properly"},
    ).json()
    print("Investigation Status:", inv["status"])
    if inv["recommendations"]:
        rec = inv["recommendations"]
        print("Issue Summary:", rec["issue_summary"])
        print("Components identified:", [c["label"] for c in rec["relevant_components"]])
        print("Suggested Tests:", rec["suggested_tests"])
        print("Next Steps:", rec["investigation_steps"])

    print("\n--- 5. Testing Real Repository Clone & Extraction ---")
    # octocat/Spoon-Knife or another public repo
    job_res = httpx.post(
        "http://127.0.0.1:8000/api/repositories",
        json={"url": "https://github.com/octocat/Spoon-Knife"},
        timeout=10.0,
    ).json()
    print("Created Job:", job_res)
    job_id = job_res["job_id"]

    for i in range(25):
        time.sleep(2)
        status = httpx.get(f"http://127.0.0.1:8000/api/jobs/{job_id}").json()
        print(f"[{i*2}s] Stage: {status['stage']} ({status['progress']}%) - {status['message']}")
        if status["stage"] in ["ready", "failed"]:
            break

if __name__ == "__main__":
    verify_live()
