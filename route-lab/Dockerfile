# route-lab — imagen del servicio (patrón voice-server: CPU, URL fija con CORS).
# La API key NO se hornea: se pasa en runtime con `-e OPENAI_API_KEY=...`.
FROM python:3.11-slim

WORKDIR /app

# deps primero (mejor cache de capas)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# el resto del servicio (.dockerignore excluye .env, jobs/, .venv, .git)
COPY . .

EXPOSE 5203

# ALLOW_ORIGINS y OPENAI_API_KEY se pasan en runtime:
#   docker build -t route-lab .
#   docker run --rm -p 5203:5203 -e OPENAI_API_KEY=sk-... route-lab
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5203"]
