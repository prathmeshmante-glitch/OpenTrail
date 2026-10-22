def calculate_metrics(data):
    return {"sum": sum(data), "len": len(data)}

class MetricProcessor:
    def __init__(self, items):
        self.items = items
    def process(self):
        return calculate_metrics(self.items)
