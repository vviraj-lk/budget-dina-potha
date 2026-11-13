# Agent instructions

This folder is Budget Dina Potha, the personal budget diary, including a Calendar screen for the Sri Lanka 2027 holidays. It is a separate project from the holiday-calendar site. Do not edit, commit, or deploy anything inside `SLHolidays2027`. The diary keeps its own read-only copy of the 2027 holiday list.

## Current phase

The owner approved the design docs. Application code in this folder is allowed. Do not create a git remote, push, or deploy until the owner asks.

Read these three docs before any later implementation:

1. [docs/skills.md](docs/skills.md)
2. [docs/guardrails.md](docs/guardrails.md)
3. [docs/tech-stack.md](docs/tech-stack.md)

If a task conflicts with those docs, stop and ask the owner.

`docs/diagrams/` and the architecture files stay on this machine. Do not commit, push, or otherwise upload them:

- `docs/diagrams/`
- `docs/tech-stack.md`
- `docs/skills.md`
- `docs/guardrails.md`

## When the app is approved

This will be an Expo web app. The phone version comes later from the same project. Before writing any code that touches an Expo, Firebase, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt and follow its links. Do not answer from memory.

Use `npx expo install <package>` for Expo-related packages. Do not use a plain `npm install` for those packages.

```bash
npx expo install <package>
npx expo start --web
npx expo lint
npx expo-doctor
npx expo export --platform web
npm test
```

Run lint and `npm test` before declaring a task done. A deploy workflow runs `npm test`, then the Firebase emulator integration job, and deploys only after both pass. The emulator job uses fake users and does not call the live Firebase project. There is no phone build, EAS build, or native `ios/` and `android/` work in the first version. If those directories are generated later, do not edit them by hand.

## Order of later work

1. Scaffold the Expo web app in this folder.
2. Connect a new Firebase project for Authentication, Firestore, and Hosting.
3. Add Google sign-in, Microsoft sign-in, and Continue on this browser.
4. Add the optional diary password and client-side encryption. Sign-in opens the diary without it. It locks only the figures and secret notes.
5. Add the calendar, entries, events, budgets, reports, bank balances, secret notes, profile and contacts, search, and the opening reminder.
6. Add unit tests for the diary maths, calendar, search, reminder, and password lock.
7. Add emulator integration tests for a saved diary, the owner-only Firestore rules, and the locked document.
8. Verify the web flows. Deploy only after the owner asks, and only through the workflow whose deploy job waits for both test jobs.
