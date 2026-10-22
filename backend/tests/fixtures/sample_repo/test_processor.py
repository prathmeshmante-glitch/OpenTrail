from processor import calculate_metrics

def test_calculate_metrics():
    res = calculate_metrics([1, 2, 3])
    assert res["count"] == 3
