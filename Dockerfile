# Dockerfile đóng gói Backend FastAPI - MediCare
FROM python:3.11-slim

WORKDIR /app

# Cài đặt system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt Python dependencies
COPY backend/requirements-runtime.txt /app/requirements-runtime.txt
RUN pip install --no-cache-dir -r requirements-runtime.txt

# Copy mã nguồn backend
COPY backend/ /app/

# Chạy ứng dụng bằng user không có quyền root.
RUN mkdir -p /app/storage && useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
