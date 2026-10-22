import httpx

def test_real_issue():
    repo_id = "bottlepy_bottle"
    issue_text = "Route decorator fails to bind handler in Bottle application and Route dispatching"
    print(f"Testing grounded issue investigation on '{repo_id}': {issue_text}")
    res = httpx.post(
        f"http://127.0.0.1:8000/api/repositories/{repo_id}/investigations",
        json={"issue_text": issue_text},
        timeout=15.0,
    ).json()

    print("Investigation Response Status:", res["status"])
    rec = res["recommendations"]
    print("Issue Summary:", rec["issue_summary"])
    print("Reasoning Summary:", rec["reasoning_summary"])
    print("\nVerified Components Grounded in Real AST Graph:")
    for comp in rec["relevant_components"]:
        print(f"  - [{comp['node_id']}] {comp['label']} ({comp['file_path']}) | Verified: {comp['is_verified']}")
        print(f"    Reason: {comp['relevance_reason']}")

    print("\nConfirmed Relationships:")
    for rel in rec["confirmed_relationships"][:5]:
        print(f"  - {rel}")

    print("\nSuggested Tests:")
    for t in rec["suggested_tests"][:4]:
        print(f"  - {t}")

    print("\nInvestigation Steps:")
    for s in rec["investigation_steps"]:
        print(f"  - {s}")

if __name__ == "__main__":
    test_real_issue()
