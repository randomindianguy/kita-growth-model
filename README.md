# Kita Growth Engine

An interactive growth model for [Kita](https://usekita.com) (YC W26) — document intelligence for lending in emerging markets.

Drag the sliders to see how retention, activation, and monetization each move Month 12 MRR. Assumptions are editable — plug in real numbers to make it yours.

**[Live Demo →](https://kita-growth.vercel.app/)**

## What This Is

A single-page React app that models three growth levers for an early-stage B2B fintech:

- **Retention** — framed as a PMF diagnostic, not just a churn metric
- **Activation** — integration drop-off and time-to-value for developer-facing products
- **Monetization** — pricing research to find the actual acceptable range

Each lever shows independent MRR impact. The chart shows combined (multiplicative) effects. A 30-day plan dynamically reorders by remaining upside as you move the sliders.

## Run Locally

```bash
npm install
npm run dev
```

Opens at `localhost:5173`.

## Deploy to Vercel

Push to GitHub → import in Vercel. It auto-detects Vite.

Or via CLI:

```bash
npm install
npx vercel
```

No environment variables needed.

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Stack

React 18, Vite 5, zero external UI libraries. All styling is inline. Fonts loaded from Google Fonts (DM Sans + Playfair Display).

## Context

Built by [Sidharth Sundaram](https://sidharthsundaram.com) as a growth analysis exercise. Not affiliated with Kita.
