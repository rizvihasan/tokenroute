# Deploy image for the hosted demo (Render). Local dev uses the raw image
# with config.yaml volume-mounted via docker-compose.
FROM ghcr.io/berriai/litellm:main-stable
COPY config.deploy.yaml /app/config.yaml
# The base image sets ENTRYPOINT to the litellm CLI, which would treat a
# shell CMD as litellm subcommands. Clear it so ${PORT} can expand in a shell.
ENTRYPOINT []
CMD litellm --config /app/config.yaml --host 0.0.0.0 --port ${PORT:-4000}
