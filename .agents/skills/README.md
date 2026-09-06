# Project-local skills

Skills installed at workspace scope (`.agents/skills/`) — they apply only to
this repository, and this directory is their only allowed location. Sources and
licenses:

| Skill                   | Source                                                                                                    | License                           | Why it's here                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tui-design`            | [gfargo/tui-design-skill](https://github.com/gfargo/tui-design-skill) (v1.7.x)                            | MIT                               | TUI/CLI design patterns; Go/Bubble Tea + Lipgloss ecosystem reference for the server-manager TUI                                           |
| `go-concurrency-review` | [eduardo-sl/go-agent-skills](https://github.com/eduardo-sl/go-agent-skills)                               | MIT                               | Goroutine/channel safety for log streaming and async server actions                                                                        |
| `go-context`            | eduardo-sl/go-agent-skills                                                                                | MIT                               | Context timeouts/cancellation for docker/script exec calls                                                                                 |
| `go-error-handling`     | eduardo-sl/go-agent-skills                                                                                | MIT                               | Error wrapping idioms for the Go TUI                                                                                                       |
| `go-coding-standards`   | eduardo-sl/go-agent-skills                                                                                | MIT                               | Go style conventions (Effective Go / Code Review Comments)                                                                                 |
| `go-test-table-driven`  | eduardo-sl/go-agent-skills                                                                                | MIT                               | Table-driven tests for docker/env output parsers                                                                                           |
| `docker-development`    | [netresearch/docker-development-skill](https://github.com/netresearch/docker-development-skill) (v1.15.1) | MIT AND CC-BY-SA-4.0              | Compose orchestration (health-gated `depends_on`, `${VAR:-}` defaults, loopback port binds) and CI compose testing for the mc-router setup |
| `shell-scripting`       | [einverne/dotfiles](https://github.com/einverne/dotfiles/tree/master/claude/skills/shell-scripting)       | none declared (personal dotfiles) | Bash patterns (strict mode, `trap`, safe iteration) for the `scripts/*.sh` management tooling and bats tests                               |

To update, re-copy from the source repos; keep the `name:` in each `SKILL.md`
frontmatter matching its directory name so the agents discover it.
