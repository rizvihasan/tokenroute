# Deploy image for the hosted demo (Render). Local dev uses the raw image
# with config.yaml volume-mounted via docker-compose.
FROM ghcr.io/berriai/litellm:main-stable
COPY config.deploy.yaml /app/config.yaml
CMD ["sh", "-c", "litellm --config /app/config.yaml --host 0.0.0.0 --port ${PORT:-4000}"]
