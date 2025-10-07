# Contributing to Kuratchi

Thank you for your interest in contributing to Kuratchi! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and professional. We're building this together.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- Git
- Cloudflare account (for testing)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/kuratchi.git
   cd kuratchi
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running the Project

```bash
# Start all dev servers
pnpm dev

# Run specific package
pnpm --filter kuratchi-sdk dev

# Run specific example
pnpm --filter basic-auth dev
```

### Making Changes

1. **Write tests first** - We follow TDD when possible
2. **Keep changes focused** - One feature/fix per PR
3. **Follow the style guide** - Run `pnpm format` before committing
4. **Update documentation** - Keep docs in sync with code changes

### Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter kuratchi-sdk test

# Run tests in watch mode
pnpm --filter kuratchi-sdk test:watch
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter kuratchi-sdk build
```

## Project Structure

```
kuratchi/
├── apps/
│   ├── docs/              # Documentation site
│   ├── dashboard/         # Admin dashboard
│   └── examples/          # Example apps
├── packages/
│   ├── kuratchi-sdk/      # Core SDK
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── auth/      # Auth system
│   │   │   │   ├── database/  # Database ORM
│   │   │   │   ├── kv/        # KV storage
│   │   │   │   └── r2/        # R2 storage
│   │   │   └── tests/         # Tests
│   │   └── package.json
│   ├── cli/               # CLI tool
│   └── config-*/          # Shared configs
```

## Contribution Guidelines

### Pull Requests

1. **Title**: Use conventional commits format
   - `feat: add OAuth plugin`
   - `fix: resolve session expiry bug`
   - `docs: update authentication guide`
   - `chore: update dependencies`

2. **Description**: Include:
   - What changed and why
   - Related issue number (if applicable)
   - Screenshots (for UI changes)
   - Breaking changes (if any)

3. **Checklist**:
   - [ ] Tests added/updated
   - [ ] Documentation updated
   - [ ] Code formatted (`pnpm format`)
   - [ ] Tests passing (`pnpm test`)
   - [ ] No TypeScript errors (`pnpm type-check`)

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:
```
feat(auth): add OAuth plugin for GitHub

- Implement OAuth flow
- Add GitHub provider
- Update documentation

Closes #123
```

### Code Style

- **TypeScript**: Use TypeScript for all code
- **Formatting**: Prettier (run `pnpm format`)
- **Linting**: ESLint (run `pnpm lint`)
- **Naming**:
  - camelCase for variables and functions
  - PascalCase for classes and types
  - UPPER_CASE for constants

### Documentation

- Update README.md for new features
- Add JSDoc comments for public APIs
- Create examples for complex features
- Keep migration guides up to date

## Areas to Contribute

### High Priority

- [ ] Complete test coverage
- [ ] Documentation improvements
- [ ] Example applications
- [ ] Bug fixes
- [ ] Performance improvements

### Medium Priority

- [ ] CLI tool development
- [ ] Admin dashboard
- [ ] Additional auth plugins
- [ ] Database features

### Low Priority

- [ ] Community plugins
- [ ] Templates
- [ ] Integrations

## Plugin Development

Want to create a plugin? Here's how:

```typescript
import type { AuthPlugin, PluginContext } from 'kuratchi-sdk/auth';

export function myPlugin(options: MyPluginOptions): AuthPlugin {
  return {
    name: 'my-plugin',
    priority: 50,
    
    async onRequest(ctx: PluginContext) {
      // Your plugin logic
    },
  };
}
```

See [PLUGIN_API.md](./packages/kuratchi-sdk/PLUGIN_API.md) for details.

## Reporting Issues

### Bug Reports

Include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)
- Code samples (if applicable)

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternative solutions considered
- Willingness to implement

## Questions?

- Open a [GitHub Discussion](https://github.com/yourusername/kuratchi/discussions)
- Join our Discord (coming soon)
- Tag us on Twitter (coming soon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Kuratchi! 🎉
