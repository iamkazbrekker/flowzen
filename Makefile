# ─────────────────────────────────────────────────────────────────────────────
# FlowZen — Makefile
# Convenience targets for Docker operations.
# Run `make help` to list all targets.
# ─────────────────────────────────────────────────────────────────────────────

.DEFAULT_GOAL := help

IMAGE_NAME  := flowzen
IMAGE_TAG   := latest
COMPOSE     := docker compose
COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml

# ── Help ──────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  FlowZen Docker targets"
	@echo "  ──────────────────────────────────────────────────────"
	@echo "  make setup        Copy .env.example → .env.local"
	@echo "  make build        Build the production Docker image"
	@echo "  make up           Start production containers (detached)"
	@echo "  make down         Stop and remove containers"
	@echo "  make dev          Start development environment (hot-reload)"
	@echo "  make dev-down     Stop development containers"
	@echo "  make logs         Tail logs from running containers"
	@echo "  make shell        Open a shell inside the running app container"
	@echo "  make clean        Remove image, containers, volumes"
	@echo "  make ps           Show running containers"
	@echo "  make health       Check /api/health endpoint"
	@echo ""

# ── First-time setup ──────────────────────────────────────────────────────────
.PHONY: setup
setup:
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local; \
		echo "  ✓ Created .env.local — fill in your API keys before running."; \
	else \
		echo "  .env.local already exists — skipping."; \
	fi

# ── Production ────────────────────────────────────────────────────────────────
.PHONY: build
build:
	$(COMPOSE) build --no-cache

.PHONY: up
up:
	$(COMPOSE) up -d

.PHONY: start
start: build up

.PHONY: down
down:
	$(COMPOSE) down

.PHONY: restart
restart: down up

# ── Development ───────────────────────────────────────────────────────────────
.PHONY: dev
dev:
	$(COMPOSE_DEV) up --build

.PHONY: dev-down
dev-down:
	$(COMPOSE_DEV) down

# ── Utilities ─────────────────────────────────────────────────────────────────
.PHONY: logs
logs:
	$(COMPOSE) logs -f

.PHONY: shell
shell:
	docker exec -it flowzen_app sh

.PHONY: ps
ps:
	$(COMPOSE) ps

.PHONY: health
health:
	@curl -sf http://localhost:$${HOST_PORT:-3000}/api/health | python3 -m json.tool 2>/dev/null \
		|| wget -qO- http://localhost:$${HOST_PORT:-3000}/api/health

# ── Cleanup ───────────────────────────────────────────────────────────────────
.PHONY: clean
clean:
	$(COMPOSE) down -v --rmi local
	docker image rm -f $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true
	@echo "  ✓ Cleaned up images, containers, and volumes."

.PHONY: prune
prune:
	docker system prune -f
