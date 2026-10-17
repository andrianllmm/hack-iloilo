<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/brand/wordmark-white.svg">
    <img src="public/brand/wordmark.svg" alt="SACKTO" width="320">
  </picture>
</p>

Post-harvest facility capacity planning for the Iloilo Rice Processing Complex (IRPC). Built for Hack Iloilo 2026.

- [PRD](PRD.md): what we build
- [TRD](TRD.md): how we build it
- [AGENTS.md](AGENTS.md): setup, commands and conventions

## Quick start

```sh
pnpm install
pnpm db:start
cp .env.example .env.local   # fill keys from `pnpm db:status`
pnpm dev
```

Sign in with `manager@irpc.test` / `password123`.
