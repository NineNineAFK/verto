# Verto - Inventory / Warehouse Manager

This repository is a small Express + Mongoose application that provides multi-warehouse inventory management with authentication (local + Google OAuth), product inventory, low-stock reporting, and audit trails.

This README explains how to set up and run the project locally and how to use the included Postman collection(s) to exercise the API.

---

## Prerequisites

- Node.js 18+ (tested with Node 20)
- npm or yarn
- MongoDB Atlas (or a local MongoDB instance)
- A Google OAuth 2.0 client (if you want Google login)

---

## Quick start (Windows / PowerShell)

1. Clone the repo and install dependencies

```powershell
cd "C:\Users\Aaditya Dawkar\Desktop\Notes\Authentication - Copy"
cd server
npm install
```

2. Create `.env` (do not commit this)

Create a file `server/.env` and add your secrets. Use the `server/.env.example` (if present) as a template. Required variables:

```
# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# App secrets
JWT_SECRET=replace-with-long-random-string
SESSION_SECRET=replace-with-long-random-string
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxx.mongodb.net/verto

# Mailer (used for password reset emails)
MAIL_SERVICE=Gmail
MAIL_USER=your@mail.com
MAIL_PASS="app-or-smtp-password"  # quote if there are spaces
MAIL_FROM=your@mail.com  # optional; defaults to MAIL_USER

NODE_ENV=development
```

3. Start the server (development)

```powershell
# from server/ directory
nodemon index.js
# or
node index.js
```

The app listens on port 3000 by default. Open http://localhost:3000/open to see the public page.

---

## Routes & Postman

Two Postman collections are included:

- `server/postman_collection_store.json` — small collection for Signup → Login → Store flow (captures cookie `uid` in tests).
- `server/postman_collection_all_routes.json` — full collection of discovered GET/POST routes (import this to explore endpoints).

How to use in Postman

1. Open Postman → File → Import → choose the JSON file above.
2. If you imported `postman_collection_store.json`, its `Signup` request will populate collection variables and its `Login` test extracts the `uid` cookie automatically (look in the collection variables after running Login).
3. For `postman_collection_all_routes.json` you can import and then either:
   - Use the smaller collection first to signup & login and copy the `uid` into the collection variable; or
   - Manually set a collection variable `uid` (the JWT cookie) and add a header `Cookie: uid={{uid}}` to requests that require authentication.

Notes

- Protected routes (under `/home`) require the `uid` cookie (JWT) to be present. Use the Login request to obtain it.
- Some routes accept `format=json` to return JSON instead of a rendered view (e.g. `/home/store?format=json`).

---

## Security notes (important)

- Do NOT commit `.env` or any secret. If you accidentally committed secrets, rotate them immediately (Google client secret, DB password, and mail password).
- `server/.gitignore` already includes `server/.env*` — ensure that is present.
- Use long random strings for `JWT_SECRET` and `SESSION_SECRET` in production.
- Use HTTPS in production and ensure `NODE_ENV=production` so cookies are marked secure.

---

## Developer tips

- Add ESLint + Prettier to standardize coding style.
- Add tests for authentication and key API endpoints.
- Consider centralizing the navigation into `views/partials/nav.ejs` to reduce duplication.

---

## Troubleshooting

- If the server crashes on startup, check the terminal for the exception. Common issues:
  - Invalid `MONGODB_URI` (Atlas connection string needs username/password and network access)
  - Missing `GOOGLE_CLIENT_*` if you attempt to start Google OAuth flows
  - Missing mail credentials if you expect password reset emails (the app will warn and continue without sending in dev)

---

## Next steps I can help with

- Add `.env.example` into the repo (sanitized template)
- Merge the cookie extraction from `postman_collection_store.json` into the full collection so auth is automatic
- Add ESLint/Prettier scaffolding and a small test harness

If you'd like me to implement any of the above, reply with which one and I'll proceed.
