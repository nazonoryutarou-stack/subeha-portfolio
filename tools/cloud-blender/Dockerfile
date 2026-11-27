# CPU-compatible Blender baseline; external GPU provider may replace image/Blender.
# No GitHub Actions or GitHub-hosted runners are used.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends blender python3 python3-pip ca-certificates && rm -rf /var/lib/apt/lists/*
RUN python3 -m pip install --break-system-packages --no-cache-dir boto3
WORKDIR /app
COPY cloud_worker.py blender_task.py ./
ENTRYPOINT ["python3", "/app/cloud_worker.py"]
CMD ["--once"]
