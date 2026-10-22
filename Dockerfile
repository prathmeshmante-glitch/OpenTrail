# OpenTrail Production Dockerfile
FROM python:3.11-slim as backend

# Install system dependencies (Git and build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend codebase
COPY backend/ ./backend/
COPY docs/ ./docs/

ENV PYTHON_EXECUTABLE=python
ENV FRONTEND_ORIGIN=http://localhost:5173

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
