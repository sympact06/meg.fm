# Contributing to meg.fm

We love your input! We want to make contributing to meg.fm as easy and transparent as possible.

## Development Process

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints (`bun run lint`).

## Project Setup

1. Install dependencies:

```bash
bun install
```

2. Copy `.env.example` to `.env` and fill in your credentials.

3. Start development server:

```bash
bun run dev
```

## Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

## Commit Guidelines

- Use clear commit messages
- Reference issues and pull requests
- Keep commits focused and atomic

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Update the version numbers in package.json following [SemVer](http://semver.org/)
3. The PR will be merged once you have sign-off from a maintainer

## Adding New Features

1. First open an issue to discuss the feature
2. Follow the TypeScript best practices
3. Add proper error handling
4. Include monitoring where appropriate
5. Add relevant tests
6. Update documentation

## Reporting Bugs

- Use the issue tracker
- Describe the bug & steps to reproduce
- Include relevant logs and screenshots
- Mention your environment details

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
