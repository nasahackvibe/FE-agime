# Final Minimal Frontend Plan (Webapp)

This project will be a desktop-focused web application with exactly four pages plus the combined auth page. No extra pages.

Pages (4 + auth):

- `/auth` — Combined Login / Register (single page with tabs)
- `/` — Dashboard (overview and quick actions)
- `/map` — Interactive Map (Cesium, polygon drawing)
- `/analysis/{farm_id}` — Analysis Results (AI insights)

Purpose: deliver a complete web product quickly with minimal surface area. Each page maps to the backend APIs listed below.

## Backend endpoints used

- Authentication: `POST /api/auth/login/`, `POST /api/auth/register/`, `GET/PUT /api/auth/profile/`
- Farms: `GET /api/farms/`, `POST /api/farms/`, `GET /api/farms/{id}/`, `PUT /api/farms/{id}/`, `DELETE /api/farms/{id}/`
- Analysis: `POST /api/farms/{id}/analyze/`, `GET /api/farms/{id}/latest-analysis/`, `GET /api/farms/{id}/analyses/`

## Minimal file structure

```
fe-agime/src/
├── api/
│   ├── client.ts        # axios instance with JWT handling
│   └── farms.ts         # wrappers for farm & analysis calls
├── pages/
│   ├── AuthPage.tsx     # combined login/register
│   ├── Dashboard.tsx
│   ├── MapPage.tsx
│   └── AnalysisPage.tsx
├── components/
│   └── Map/CesiumMap.tsx
└── App.tsx
```

## Quick integration steps

1. Install frontend deps:

```powershell
cd fe-agime
npm install axios react-router-dom
```

2. Create `fe-agime/.env` with `VITE_API_BASE_URL` and `VITE_CESIUM_ACCESS_TOKEN`
3. Implement axios client and JWT storage in `localStorage`
4. Wire Cesium polygon completion to `POST /api/farms/` to create farms
5. Add an "Analyze" action that calls `POST /api/farms/{id}/analyze/` and routes to `/analysis/{farm_id}`

This is the final, minimal plan — exactly four pages plus the auth page. Ready to implement.
