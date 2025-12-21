# SafeGuard — Capstone (Option 2)

## What this is
Simple women-safety demo: frontend (single HTML) + backend (Node.js + MySQL). Frontend captures location, saves incident to backend, and opens messaging app to send location to contacts.

## Setup (high level)

Prereqs:
- Node.js (v16+), npm
- MySQL (server) and ability to run SQL
- VS Code (recommended)

1. Create DB & tables:
   - Open MySQL and run `db/schema.sql`.

2. Backend:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # edit .env with DB credentials
   node server.js
