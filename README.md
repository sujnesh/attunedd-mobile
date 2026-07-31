# Attunedd Mobile

React Native + TypeScript mobile app for adaptive strength training. The app pairs workout execution, health-signal ingestion, local state, and backend sync with the Attunedd Rails API.

This repo is the mobile client for the Attunedd coaching system: onboarding, dashboard, planned/free-form workouts, post-workout debriefs, health data, and sync reliability.

## What It Does

- Runs onboarding, login, registration, settings, and dashboard flows
- Supports planned workouts and free-form workout logging
- Tracks active workout state, timers, deviations, nudges, overrides, and post-workout debriefs
- Imports health signals from Apple Health and Android Health Connect
- Normalizes and deduplicates health samples before sync
- Uses a local event queue and reconciliation engine for mobile/backend state sync
- Evaluates readiness, stress, fatigue, and background signals for coaching context
- Sends notifications from policy-driven state changes

## Project Layout

```text
src/navigation/        App and training navigation stacks
src/screens/           Auth, onboarding, dashboard, health, settings, training screens
src/screens/train/     Workout execution, plan detail, history, and debrief screens
src/health/            Apple Health, Health Connect, normalization, dedupe, ingestion
src/services/          API client, workout, check-in, readiness, health, and parser services
src/state/             Background bridge, evaluation, scheduling, notification policy
src/sync/              Event queue, event types, reconciliation, sync engine
src/workout/           Active workout controller and coaching/session engines
__tests__/             Jest smoke tests
```

## Tech Stack

- React Native 0.84
- TypeScript
- React Navigation
- SQLite local storage
- Apple Health and Health Connect integrations
- Background fetch
- Push notifications
- Jest, ESLint, Prettier
- GitHub Actions CI

## Run Locally

Install dependencies:

```bash
npm install
```

Start Metro:

```bash
npm start
```

Run the app:

```bash
npm run ios
npm run android
```

Run checks:

```bash
npm test
npm run lint
```

## Backend

The app is designed to talk to the [Attunedd Rails API](https://github.com/sujnesh/attunedd). Configure the API base URL in the mobile service layer before using backend-backed flows.

## Why This Project Matters

The hard part is not rendering a workout screen. It is keeping coaching state coherent across user edits, health signals, background sync, partial failures, and real workout behavior. This app focuses on that reliability layer.
