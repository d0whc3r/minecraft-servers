# Contributing to Minecraft Multi-Server System

Thank you for your interest in contributing to the Minecraft Multi-Server System! We welcome contributions from the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)
- [Documentation](#documentation)

## Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. By participating, you agree to:

- Be respectful and inclusive
- Focus on constructive feedback
- Accept responsibility for mistakes
- Show empathy towards other contributors
- Help create a positive community

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/minecraft-servers.git
   cd minecraft-servers
   ```
3. **Set up the development environment** (see [Development Setup](#development-setup))
4. **Create a feature branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## How to Contribute

### Types of Contributions

- **🐛 Bug fixes** - Fix existing issues
- **✨ New features** - Add new functionality
- **📚 Documentation** - Improve documentation
- **🧪 Tests** - Add or improve tests
- **🔧 Scripts** - Improve management scripts
- **🎨 UI/UX** - Improve user experience
- **📦 Modpacks** - Add new pre-configured modpacks

### Contribution Guidelines

- **Keep changes focused** - One feature/fix per pull request
- **Follow existing patterns** - Maintain consistency with the codebase
- **Test your changes** - Ensure tests pass and functionality works
- **Update documentation** - Keep docs in sync with code changes
- **Use clear commit messages** - Follow conventional commit format

## Development Setup

### Prerequisites

- Docker Engine 20.10+
- Docker Compose v2+
- Bash 4.0+
- Node.js 22+ (for CI/testing)
- pnpm (for dependency management)

### Local Setup

1. **Clone and setup**:

   ```bash
   git clone https://github.com/your-username/minecraft-servers.git
   cd minecraft-servers
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Validate setup**:

   ```bash
   ./scripts/validate-config.sh --system
   ```

4. **Run tests**:
   ```bash
   pnpm test
   ```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run BATS tests only
pnpm test:bats

# Run with coverage
pnpm test:coverage
```

### Test Guidelines

- **Write tests** for new features and bug fixes
- **Test edge cases** and error conditions
- **Use descriptive test names** that explain what they're testing
- **Keep tests fast** and reliable
- **Test both success and failure scenarios**

### CI/CD Pipeline

The project uses GitHub Actions for continuous integration:

- **Automated testing** on every push/PR
- **Parallel test execution** for faster feedback
- **Multi-environment testing** (different modpacks)
- **Code quality checks** (linting, formatting)

## Submitting Changes

### Pull Request Process

1. **Ensure tests pass** locally
2. **Update documentation** if needed
3. **Rebase your branch** on the latest master
4. **Create a pull request** with a clear description:
   - What changes were made
   - Why the changes were needed
   - How to test the changes
   - Any breaking changes

### Commit Message Format

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

**Examples:**

```
feat: add support for Modrinth modpacks
fix: resolve port conflict detection
docs: update installation guide
test: add validation for server configs
```

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Clear title** describing the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs actual behavior
- **Environment details** (OS, Docker version, etc.)
- **Logs and error messages**
- **Screenshots** if applicable

### Feature Requests

For feature requests, please include:

- **Clear description** of the proposed feature
- **Use case** and why it's needed
- **Implementation ideas** if you have any
- **Potential impact** on existing functionality

## Documentation

### Documentation Standards

- **Keep it up to date** with code changes
- **Use clear, simple language**
- **Include examples** where helpful
- **Organize by user tasks** rather than code structure
- **Test documentation** by following your own instructions

### Documentation Structure

```
docs/
├── QUICKSTART.md          # Getting started guide
├── ARCHITECTURE.md        # System design
├── ADDING_MODPACKS.md     # Adding custom modpacks
├── BACKUP_RESTORE.md      # Backup procedures
├── MONITORING.md          # Health monitoring
├── TROUBLESHOOTING.md     # Common issues
└── modpacks/             # Individual modpack guides
    └── modpack-name.md
```

## Adding Pre-Configured Modpacks

To add a new pre-configured modpack:

1. **Research the modpack**:

   - Check CurseForge/Modrinth for download URLs
   - Verify Minecraft version compatibility
   - Determine recommended memory requirements

2. **Create configuration**:

   ```bash
   ./scripts/add-modpack.sh modpack-name --modpack=template
   # Edit config/modpacks/modpack-name.env
   ```

3. **Test the configuration**:

   ```bash
   ./scripts/start-server.sh modpack-name
   # Verify it starts and works correctly
   ```

4. **Add documentation**:

   - Create `docs/modpacks/modpack-name.md`
   - Update modpack table in README.md
   - Add to CI test matrix if appropriate

5. **Submit as PR** with:
   - Configuration file
   - Documentation
   - Test results

## Recognition

Contributors will be recognized in:

- Repository contributors list
- Changelog for significant contributions
- Special mentions in release notes

## Questions?

If you have questions about contributing:

- Check existing [issues](https://github.com/yourusername/minecraft-servers/issues) and [discussions](https://github.com/yourusername/minecraft-servers/discussions)
- Create a new discussion for questions
- Join our community chat (if available)

Thank you for contributing to the Minecraft Multi-Server System! 🚀
