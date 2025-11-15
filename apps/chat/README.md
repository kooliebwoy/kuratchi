# Kuratchi Chat

A real-time support and feedback chat application built with SvelteKit, DaisyUI, and Tailwind CSS 4.

## Overview

This is the support chat application for Kuratchi, where users can get help, submit feedback, and communicate with the support team.

## Tech Stack

- **Framework**: SvelteKit (Svelte 5)
- **Styling**: Tailwind CSS 4 + DaisyUI
- **Runtime**: Cloudflare Workers
- **Database**: D1 (Cloudflare)
- **Storage**: R2 (Cloudflare)
- **AI**: Cloudflare AI

## Features

- Real-time chat interface
- Help requests
- Feedback submissions
- Support ticket management
- Message history

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Environment

The app is configured to run on Cloudflare Workers with the following bindings:

- `CHAT_DB`: D1 Database
- `KV`: KV Namespace
- `BUCKET`: R2 Bucket
- `AI`: Cloudflare AI

## Domain

Production: `https://chat.kuratchi.dev`
