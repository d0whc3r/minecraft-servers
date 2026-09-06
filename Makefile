# Root Makefile — single entry point for the whole monorepo: the mc-tui Go
# module (apps/tui), the web panel (web/), the bash management scripts and
# their bats suite.
#
# Go targets run inside apps/tui via `go -C`; lint tools are pinned in that
# module's `tool` block (go.mod) and built on demand with `go tool`.

BIN     := bin/mc-tui
TUI     := apps/tui
WEB     := web
DIST    := dist
COVER   := coverage
TMP     := .tmp
MODULE  := $(shell go -C $(TUI) list -m)

GO := go -C $(TUI)

# Some shells wrap make behind another binary, which would poison recursive
# $(MAKE); pin the real one.
MAKE := /usr/bin/make

# Modules behind the go.mod `tool` block. Lazy `=`: only evaluated by targets
# that need it, so plain `make build` stays fast.
TOOL_MODULES := $(shell cd $(TUI) && go list -f '{{.Module.Path}}' tool 2> /dev/null | sort -u)

OUTDATED_FMT := {{if and (not .Indirect) .Update}}{{.Path}} {{.Version}} -> {{.Update.Version}}{{end}}

HOST_OS   := $(shell go env GOHOSTOS)
HOST_ARCH := $(shell go env GOHOSTARCH)

# Cross-compile switches. `make build` targets the host; anything else must
# be explicit: `make build OS=linux ARCH=arm64` or `make build OS=all ARCH=all`.
OS   ?= $(HOST_OS)
ARCH ?= $(HOST_ARCH)

# mc-tui drives bash and docker, so only unix-like targets make sense; a
# windows binary could build but would have nothing to run.
PLATFORMS := \
	linux/amd64 \
	linux/arm64 \
	linux/arm \
	darwin/amd64 \
	darwin/arm64

# Go sources relative to $(TUI) (the module root is the main package).
GOSRC := . ./internal

# Bash side: every management script (incl. CI helpers) plus its bats suite.
SHFILES   := $(wildcard scripts/*.sh) $(wildcard scripts/ci/*.sh)
BATSFILES := $(wildcard tests/bats/*.bats)
SHSTAMP   := $(TMP)/test-sh.cksum

.PHONY: help all build build-one run release test test-sh test-bats vet fmt \
	fmt-check lint check cover cover-html vuln outdated tidy install web-build \
	hooks clean

help: ## list targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

all: hooks check build

build: ## build mc-tui for OS/ARCH (host by default, OS=all ARCH=all for the matrix)
	@mkdir -p "$(dir $(BIN))" "$(DIST)"
	@if [ "$(OS)" = "all" ] || [ "$(ARCH)" = "all" ]; then \
		for platform in $(PLATFORMS); do \
			$(MAKE) --no-print-directory build-one OS=$${platform%/*} ARCH=$${platform#*/}; \
		done \
	else \
		$(MAKE) --no-print-directory build-one OS=$(OS) ARCH=$(ARCH); \
	fi

build-one: ## internal: build one OS/ARCH pair (host -> bin/, cross -> dist/, stripped)
	@mkdir -p "$(dir $(BIN))" "$(DIST)"
	@if [ "$(OS)" = "$(HOST_OS)" ] && [ "$(ARCH)" = "$(HOST_ARCH)" ]; then \
		echo "cc $(TUI) -> $(BIN)"; \
		$(GO) build -o "../../$(BIN)" .; \
	else \
		echo "cc $(TUI) -> $(DIST)/mc-tui-$(OS)-$(ARCH)"; \
		CGO_ENABLED=0 $(GO) build -trimpath -ldflags "-s -w" \
			-o "../../$(DIST)/mc-tui-$(OS)-$(ARCH)" .; \
	fi

run: build ## build + launch the dashboard
	./$(BIN)

release: ## build the full platform matrix into dist/ (stripped)
	$(MAKE) --no-print-directory build OS=all ARCH=all

test: ## go tests with the race detector
	$(GO) test -race ./...

test-sh: $(SHSTAMP) ## bash side: syntax checks + fast bats cases (no docker, cached)
	@cat $(SHSTAMP)

# config-validation.bats is the no-server-startup suite (its only Docker use
# renders the compose files with the CLI); server-startup.bats (real server
# starts) is deliberately excluded — run `make test-bats` for the full suite.
$(SHSTAMP): Makefile $(SHFILES) $(BATSFILES)
	@mkdir -p "$(TMP)"
	@for f in $(SHFILES); do bash -n "$$f" || exit 1; done
	pnpm exec bats tests/bats/config-validation.bats
	@cksum $(SHFILES) $(BATSFILES) Makefile > $@

test-bats: ## full bats suite (slow: starts real servers, needs docker)
	pnpm exec bats tests/bats/

vet: ## go vet
	$(GO) vet ./...

fmt: ## rewrite Go imports (goimports, module-local grouping)
	$(GO) tool goimports -w -local $(MODULE) $(GOSRC)

fmt-check: ## fail if any Go file is unformatted
	@out=$$($(GO) tool goimports -l -local $(MODULE) $(GOSRC)); \
	if [ -n "$$out" ]; then \
		echo "unformatted files (run: make fmt):"; echo "$$out"; exit 1; \
	fi

lint: fmt-check vet ## static analysis: fmt-check + vet + staticcheck
	$(GO) tool staticcheck ./...

check: lint test test-sh ## everything CI should gate on

cover: ## coverage profile + per-function table
	@mkdir -p "$(COVER)"
	$(GO) test -race -covermode=atomic -coverpkg=./... -coverprofile="../../$(COVER)/cover.out" ./...
	$(GO) tool cover -func="../../$(COVER)/cover.out"

cover-html: cover ## coverage as an HTML page
	$(GO) tool cover -html="../../$(COVER)/cover.out" -o "../../$(COVER)/cover.html"

vuln: ## known vulnerabilities in the dependency graph (needs network)
	$(GO) tool govulncheck ./...

outdated: ## newer Go module/tool versions, plus workspace JS deps
	@echo "== $(MODULE) =="
	$(GO) list -m -u -f '$(OUTDATED_FMT)' all | grep -v '^$$' || echo "  everything current"
	@echo "== tools =="
	$(GO) list -m -u -f '$(OUTDATED_FMT)' $(TOOL_MODULES) 2> /dev/null | grep -v '^$$' || echo "  everything current"
	@echo "== workspace JS =="
	-@pnpm outdated -r

tidy: ## sync go.mod/go.sum
	$(GO) mod tidy

install: ## install workspace JS dependencies (pnpm)
	pnpm install

web-build: ## build the web panel
	pnpm --filter mc-servers-web build

hooks: ## point git at the husky hooks
	git config core.hooksPath .husky

clean: ## remove build and coverage artifacts
	rm -rf $(BIN) $(DIST) $(COVER) $(TMP)
