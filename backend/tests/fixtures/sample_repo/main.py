from processor import MetricProcessor

def main():
    proc = MetricProcessor([1, 2, 3])
    print(proc.process())

if __name__ == '__main__':
    main()
