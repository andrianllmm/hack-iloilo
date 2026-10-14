# AGENTS.md

## Project Overview

This project is for the ILOILO PROVINCE STARTUP HACKATHON, read guidelines in GUIDELINES.md if you need more context.

[insert later]

## Project Structure

[insert later]

## Tech Stack

[insert later]

## Quick Start

[insert later]

## Commands

[insert later]

## Environment Variables

[insert later]

## Code Conventions

### Style

- **Prettier**
- **ESLint**

### Git

- Use Conventional Commits (enforced by commitlint): `type(scope): concise description`.
- Keep commits atomic: each commit should represent one logical, self-contained change.
- Keep commit messages concise.
- Do not co-author commits or include yourself in commit messages.
- Do not amend, rebase, reset, or otherwise rewrite existing commits unless explicitly requested.
- Before committing, inspect the diff and ensure it contains only intended changes.
- When updating a branch with changes from its base branch, prefer rebasing over merging.

#### Branches

- Use descriptive branch names with the format `type/<short-description>`; prefer `feat/` over `feature/`.
- Do not include issue number in branch names.
- Keep branches focused on a single issue or logical change.
- Create a dedicated branch for each change. Do not make changes directly on the default branch.

#### Issues

- Keep issues focused and reasonably sized.
- Create an issue before opening a PR when the change is substantial enough to warrant dedicated tracking. For one-off changes, quick fixes, or simple patches that do not benefit from a dedicated issue, a PR may be created directly unless the user explicitly requests an issue.

#### Pull Requests

- Keep PRs focused and reasonably sized.
- Link the PR to its corresponding issue using `Closes #<issue-number>` when the PR fully resolves the issue.
- If a corresponding issue exists but the PR does not fully resolve it, link the issue without using a closing keyword.

## Verification

- Verify every code change before considering the task complete.
- Run the checks relevant to the files and behavior changed.
- At minimum, run linting for code changes.
- Use Playwright/browser automation ONLY WHEN NEEDED for browser behavior, end-to-end verification, or visual inspection of UI changes. Prefer static inspection and existing tests when sufficient; avoid unnecessary browser interactions and screenshots.

## Skills & Docs Reference

[insert later]
