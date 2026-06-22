# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DefFinance v1** é um dashboard financeiro full-stack para pequenas e médias empresas com:
- **Frontend**: SPA React 18 + Vite, Tailwind CSS, componentes Radix UI/shadcn
- **Backend**: Node.js 20 + Express para servir assets e APIs de integração
- **Database**: Supabase (auth, armazenamento, Edge Functions)
- **Integrações**: Google Sheets API v4, Google Tasks API v1

## Development Commands

```bash
# Start development server (Vite + HMR)
npm run dev

# Start Vite client-only (frontend development)
npm run dev:client

# Build for production
npm run build

# Preview production build locally
npm run preview

# Start Express server (production mode)
npm run start

# Run backend tests (Node test runner)
npm run test
```

**Note**: `npm run dev` starts the full stack (Express server on development). For frontend-only work, use `npm run dev:client` (Vite on port 3000).

## Architecture

### Frontend Structure (`src/`)
- **components/**: Reusable UI blocks (Radix UI + shadcn patterns, forms, pedagogical indicators)
- **pages/**: Full-screen routes (Dashboard, ContasPagar, ContasReceber, Lancamentos, Relatorios, Cadastros, etc.)
- **contexts/**: `SupabaseAuthContext` — centralized auth state and session management
- **lib/**: `customSupabaseClient.js` — shared Supabase client, utilities
- **services/**: External API integrations (Google Sheets, Google Tasks)
- **App.jsx**: Route definitions with `PrivateRoute` protection
- **main.jsx**: React + Tailwind initialization

### Backend Structure (`server/`)
- **app.js**: Express factory; serves built assets (prod) or delegates to Vite (dev), compression enabled
- **index.js**: Entry point for `npm run start`
- **googleTasksRoutes.js**: `/api/google-tasks/*` endpoints (list, create, update, complete, delete tasks via OAuth)
- **loadEnv.js**: Environment variable loader
- **app.test.js**: Basic health check test

### Data Flow
1. **Supabase**: `lancamentos` table stores financial transactions; auth via `supabase.auth.*` with `onAuthStateChange` listener
2. **Google Sheets**: Triggered from Dashboard; backend calls `/api/google-sheets/import` → Google Sheets API → persists raw data to `localStorage` as offline fallback
3. **Google Tasks**: Frontend calls `/api/google-tasks/tasks` endpoints for CRUD operations; used by Administrativo screens

## Key Patterns

### Authentication
- Protected routes via `PrivateRoute` wrapper (redirects unauthenticated users to `/login`)
- `SupabaseAuthContext` exposes `signIn`, `signUp`, `logout`, `user`, `isLoading`
- Session state persists via Supabase listener

### UI & Styling
- **Tailwind CSS** with custom tokens in `tailwind.config.js` (gradients, glass effects)
- **Radix UI** primitives wrapped in shadcn/ui style components (`button`, `card`, `input`, `select`, `calendar`, etc.)
- **Toast notifications**: `useToast` hook + global `Toaster` component (variants: default, destructive)
- **Animations**: Framer Motion for motion primitives, Recharts for data visualization

### Forms
- `LancamentoForm` is the main form pattern; reuses UI components with `class-variance-authority` for styling variants
- Validation is inline; consider adding a dedicated form library if complexity grows

### Export & Reports
- **PDF generation**: `jspdf` + `jspdf-autotable` + `html2canvas` (render React → canvas → PDF)
- **Excel export**: `xlsx` library for `.xlsx` files
- Reports page aggregates data from multiple sources and provides print-friendly views

## Environment Variables

Create `.env` in the root with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
GOOGLE_API_KEY=...
GOOGLE_SHEET_PAGAMENTOS_ID=...
GOOGLE_SHEET_RECEBIMENTOS_ID=...
GOOGLE_TASKS_CLIENT_ID=...
GOOGLE_TASKS_CLIENT_SECRET=...
GOOGLE_TASKS_REFRESH_TOKEN=...
GOOGLE_TASKS_LIST_ID=@default
```

⚠️ **Security**: Remove hardcoded keys before production. Currently using placeholder values for development.

## Testing

- **Backend**: `npm run test` runs `node --test` on `server/*.test.js` and `src/domain/*.test.js`
- **Frontend**: No automated test suite yet; manual testing via browser or add Vitest + Testing Library

## Build & Deployment

1. `npm run build` generates `dist/` (Vite bundles React + Tailwind)
2. `npm run start` (after build) runs Express serving `dist/` with compression
3. Pre-build hook `node tools/generate-llms.js` (optional, may fail silently)

## Common Tasks

- **Add a new page**: Create `.jsx` in `src/pages/`, add route to `App.jsx`, protect with `PrivateRoute` if needed
- **Add a UI component**: Follow shadcn/ui pattern in `src/components/ui/`, use `class-variance-authority` for variants
- **Query Supabase**: Use shared client from `src/lib/customSupabaseClient.js`
- **Import external data**: Add endpoint in `server/` and call from frontend via `fetch` or service function
- **Troubleshoot HMR**: Ensure `npm run dev` is running (not `dev:client` alone); check Vite config if middleware mode fails
