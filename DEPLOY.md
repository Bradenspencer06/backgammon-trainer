# Deploying the engine stack

The app talks to GNU through an **engine BFF** (batch + cache + server-side parallelism) when the browser can reach it. The static SPA must be built with **`VITE_ENGINE_BFF_URL`** set to the public URL of the BFF (no trailing slash).

## 1. Run GNU + BFF (Docker Compose)

From the repo root:

```bash
docker compose up -d --build
```

- GNU: `http://HOST:8080`
- BFF: `http://HOST:3001` (POST `/api/v1/batch-getmoves`, GET `/health`)

Set CORS if the UI is on another origin:

```bash
ENGINE_BFF_CORS_ORIGIN=https://your-frontend.example.com docker compose up -d --build
```

## 2. Build the frontend

```bash
VITE_ENGINE_BFF_URL=https://your-bff.example.com npm run build
```

Serve the `dist/` folder from any static host (S3, Netlify, nginx, etc.).

## 3. Local development (recommended)

Three processes: GNU container, BFF, Vite.

```bash
docker run --rm -p 8080:8080 foochu/bgweb-api:latest
npm run dev:stack
```

Vite proxies `/engine-bff` → `localhost:3001` and `/bgweb-api` → `localhost:8080`.

## 4. Hosted options

You typically need **two** managed services (or one VM running Compose):

1. **Container** running `foochu/bgweb-api` (GNU).
2. **Container** running this repo’s BFF (`Dockerfile.bff`) with `BGWEB_UPSTREAM` pointing at (1) on the private network.

Point `VITE_ENGINE_BFF_URL` at the public URL of (2). Do not expose GNU to the public internet if you can avoid it—only the BFF needs to be public.
