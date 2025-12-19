# Clad Dashboard

[![CI](https://github.com/clad-sovereign/clad-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/clad-sovereign/clad-dashboard/actions/workflows/ci.yml)

Read-only monitoring dashboard for [Clad](https://clad.so) tokenization infrastructure. Built with SvelteKit and connects to clad-node via Substrate RPC.

## Overview

Clad Dashboard provides visibility into the Clad token ecosystem for debt office staff and ministry officials. It displays:

- **Token metrics** - Total supply, balances, whitelist status
- **Event history** - Mints, transfers, freezes, whitelist changes
- **Multi-sig status** - Pending approvals and signatory information
- **Node health** - Connection status, block production, chain info

> **Note:** This dashboard is read-only. Transaction signing is handled by [clad-mobile](https://github.com/clad-sovereign/clad-mobile).

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (package manager and runtime)
- A running clad-node instance

### Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Connect to Local Node

In a separate terminal, start a local clad-node:

```bash
# In clad-studio directory
./target/release/clad-node --dev --tmp
```

The dashboard will automatically connect to `ws://127.0.0.1:9944`.

## Tech Stack

- **Framework**: [SvelteKit 2](https://svelte.dev) with Svelte 5 (runes syntax)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com)
- **Blockchain**: [@polkadot/api](https://polkadot.js.org/docs/api) for Substrate RPC
- **Runtime**: [Bun](https://bun.sh)

## Project Structure

```
src/
├── lib/
│   ├── components/     # Svelte components (Header, Sidebar)
│   ├── substrate/      # Polkadot API client and types
│   └── index.ts
├── routes/
│   ├── +layout.svelte  # Root layout
│   ├── +page.svelte    # Overview dashboard
│   ├── balances/       # Balance lookup
│   ├── whitelist/      # Whitelist status
│   ├── events/         # Event history
│   ├── multisig/       # Multi-sig approvals
│   └── settings/       # Configuration
└── app.html
```

## Scripts

```bash
bun run dev       # Start development server
bun run build     # Production build
bun run preview   # Preview production build
bun run check     # TypeScript type checking
bun run lint      # Run prettier + eslint
bun run format    # Auto-format code
```

## Configuration

The dashboard connects to `ws://127.0.0.1:9944` by default. This can be changed in the Settings page (persisted to localStorage).

## Related Projects

| Project                                                        | Description                                             |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| [clad-studio](https://github.com/clad-sovereign/clad-studio)   | Substrate blockchain (pallet-clad-token, runtime, node) |
| clad-mobile (private)                                          | Kotlin Multiplatform mobile signer (iOS/Android)        |
| [clad-website](https://github.com/clad-sovereign/clad-website) | Marketing landing page                                  |

## License

[Apache-2.0](LICENSE)
