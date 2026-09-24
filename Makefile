.PHONY: up models test dev

up:        ## build and start the full stack
	docker compose up --build -d

models:    ## pull the local models into ollama (one-time, ~5GB)
	docker compose exec ollama ollama pull llama3.1:8b-instruct-q4_K_M
	docker compose exec ollama ollama pull nomic-embed-text

test:      ## gateway unit tests (no services required)
	cd gateway && python -m pytest tests -q

dev:       ## run gateway + web against local deps
	docker compose up db redis ollama litellm -d
