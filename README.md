# Ubuntu Roots Platform

**Our Family. Our Strength.**

This repository is now grouped into:

- `frontend/` — Next.js full-stack app (web UI + current REST APIs)
- `backend/` — standalone Node/Express backend scaffold
- `mobile/` — React Native (Expo) mobile scaffold

## Monorepo Structure

```txt
UbuntuRoots/
  backend/
  frontend/
  mobile/
```

## Where core implementation currently lives

The fully implemented Ubuntu Roots product (family tree, funeral contributions, roles, OTP auth, Prisma models, dashboard, memorial pages) is in:

- `frontend/app/**`
- `frontend/components/**`
- `frontend/lib/**`
- `frontend/prisma/**`

## Install & Run

From repository root:

```bash
npm install
```

### Frontend (primary app)

1. Copy env file:

```bash
copy frontend\.env.example frontend\.env
```

2. Generate Prisma client:

```bash
npm --workspace frontend run prisma:generate
```

3. Push schema:

```bash
npm --workspace frontend run db:push
```

4. Seed demo data:

```bash
npm --workspace frontend run prisma:seed
```

5. Run web app:

```bash
npm run dev:frontend
```

Web URL: `http://localhost:3000`

### Backend scaffold

```bash
npm run dev:backend
```

Backend health URL: `http://localhost:4000/health`

### Mobile scaffold

```bash
npm run dev:mobile
```

## Seed Login Accounts (Frontend OTP)

- Super Admin: `+27119990001`
- Treasurer: `+27119990002`
- Member: `+27119990003`

OTP codes are logged locally by the frontend service.

## Notes

- If your IDE shows module/type errors, run `npm install` first.
- Current production feature set is in `frontend/`.
- `backend/` and `mobile/` are grouped scaffolds ready for gradual expansion.
