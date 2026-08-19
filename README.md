# DevPulse Nexus

Act as a Principal Full-Stack Engineer and UX Architect. I need you to build a highly unique, production-ready web application ecosystem called "DevPulse" — a next-generation workspace and collaboration hub for Developers and ICT Students. 

The application must feature an ultra-modern, bento-grid inspired, dark-themed UI (similar to Linear, Vercel, or Apple’s developer dashboards) with fluid micro-interactions and a sleek, developer-centric aesthetic.

### 1. Advanced Tech Stack & Architecture

- **Frontend:** Next.js 14+ (App Router), React 19, Tailwind CSS v4, Shadcn/ui, and Framer Motion (for fluid animations).

- **Authentication:** Supabase Auth (supporting Magic Links, Passwordless Passkeys, and GitHub/Google OAuth).

- **Database & Real-time:** Supabase (PostgreSQL) with Row-Level Security (RLS) and Realtime Broadcast channels for collaboration.

- **State & Storage:** Zustand for lightweight global state, IndexedDB (via Dexie.js) for robust offline-first caching of student notes and code snippets.

### 2. Premium Authentication & Onboarding

- **Passwordless Entry:** Support WebAuthn/Passkeys (biometric login via fingerprint/FaceID) alongside standard GitHub OAuth.

- **Tailored Onboarding Flow:** Upon first login, an interactive multi-step form asks the user if they are a "Student" or "Developer", fields their current tech stack preferences, and instantly customizes their dashboard layout based on their skill level.

### 3. Hyper-Unique & Advanced Features

Please architect and write components for the following highly unique modules:

* **A. The Bento Portfolio Generator (Unique feature):**

    - Instead of a boring profile, users can toggle a switch to make their profile public, transforming it into a beautiful, shareable Bento-grid portfolio website.

    - It automatically pulls their saved code snippets, completed learning roadmaps, GitHub stats, and project showcases into an interactive, sleek portfolio layout.

* **B. Peer-to-Peer Code Review Labs (Real-time feature):**

    - A module where ICT students can submit a specific file or block of code for review.

    - Other users can highlight specific lines of code and leave inline comments, suggestions, or "upvotes" for elegant solutions, creating an educational, StackOverflow-style peer review network.

* **C. Offline-First "DevNotes" Markdown Editor:**

    - A rich Markdown editor tailored for taking quick lecture notes, system architecture ideas, or command-line cheatsheets.

    - It must work fully offline using browser local storage/IndexedDB and sync perfectly back to Supabase once an internet connection is detected.

* **D. Gamified "Daily Bug" Challenges:**

    - A dedicated zone displaying a daily broken code snippet (Syntax errors, logic bugs, or security vulnerabilities in languages like JavaScript, Python, or SQL).

    - Students race to locate and patch the bug. Solving it earns them profile XP, climbing a global leaderboard displayed on the dashboard.

* **E. Smart Config & Command Palette:**

    - A global `Cmd + K` (or `Ctrl + K`) command palette that lets users instantly navigate the site, search snippets, toggle themes, or trigger the AI helper from anywhere.

### 4. High-End UI/UX Design & Component Guidelines

- **Layout Structure:** A bento-box grid dashboard that prioritizes data visualization. Use clean, micro-thin borders, subtle radial gradients, and crisp typography (e.g., Geist Mono or Inter).

- **Component Polish:** Implement skeleton loading states, glassmorphism card overlays, smooth layout transitions using Framer Motion, and distinct toast notifications (using sonner) for actions like "Passkey Verified", "Code Copied", or "Sync Complete".

Please generate the complete project architecture structure, the PostgreSQL schema representing this ecosystem, the Supabase Auth setup script, and the core frontend files for the Bento Dashboard page and the Real-time Review Lab component.

fix this prompt

say make all system work

make all work with all

don't make clone please

make full without make fake and they add then only show

make show many pages and others what needed for developer and please make all needed for developer with home page and what needed for learn and teach make moderna and others please 

Make all must work don't make clone please make 

fix this prompt

make show much pages and others and other needed for developer and begineer to learn and teach make to much pages and home pages and others please 

don't make only clone make all system work please 

make all featurs and uniques

make more features and make all at once and others

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://devpulse-nexus.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e6e0ea71-ab2b-44dc-8973-23400c548c27).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
