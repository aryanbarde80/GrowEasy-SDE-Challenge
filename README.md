# GrowEasy AI CSV Importer

An AI-powered CSV importer built for the GrowEasy Software Developer assignment. It accepts messy lead CSVs from different sources, previews them on the frontend, and converts them into the required GrowEasy CRM schema through an Express API with OpenAI-backed extraction and a heuristic fallback.

## Stack

- Frontend: Next.js 16, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- CSV parsing: Papa Parse
- AI extraction: OpenAI Chat Completions API
- Deployment: Render Blueprint via `render.yaml`

## Features

- Drag and drop CSV upload
- Client-side CSV preview before any AI processing
- Responsive preview and results tables
- Sticky table headers with horizontal and vertical scrolling
- Confirm-before-import flow
- Batch AI extraction with retry support
- Heuristic fallback when the AI provider is unavailable
- Skipped-record reporting for rows with no email and no mobile number
- Render-ready deployment blueprint
- Backend unit tests for core extraction rules

## Project structure

```text
.
├── backend
│   ├── src
│   └── tests
├── frontend
│   └── src
└── render.yaml
```

## Local development

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

Create `backend/.env` if you want OpenAI extraction locally:

```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
AI_BATCH_SIZE=8
AI_BATCH_RETRIES=1
PORT=4000
```

Optional frontend variable:

```bash
BACKEND_PUBLIC_URL=http://localhost:4000
```

If `OPENAI_API_KEY` is not set, the backend still runs using the built-in heuristic mapper.

### 3. Run the backend

```bash
cd backend
npm run dev
```

### 4. Run the frontend

```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:3000`

Backend health endpoint: `http://localhost:4000/api/health`

## API

### `POST /api/import`

Accepts `multipart/form-data` with a single `file` field containing a CSV file.

Returns:

- `importedRecords`
- `skippedRecords`
- `importedCount`
- `skippedCount`
- processing metadata such as provider, batch size, fallback usage, and retry count

## CRM extraction behavior

- Allowed CRM statuses:
  - `GOOD_LEAD_FOLLOW_UP`
  - `DID_NOT_CONNECT`
  - `BAD_LEAD`
  - `SALE_DONE`
- Allowed data sources:
  - `leads_on_demand`
  - `meridian_tower`
  - `eden_park`
  - `varah_swamy`
  - `sarjapur_plots`
- If multiple emails are found, the first one is used and the rest go into `crm_note`
- If multiple phone numbers are found, the first one is used and the rest go into `crm_note`
- Records without both email and mobile are skipped
- `created_at` is normalized into a JavaScript-compatible ISO string when possible

## Testing

```bash
cd backend
npm test
```

## Render deployment

This repository includes a `render.yaml` Blueprint that provisions:

- `groweasy-csv-importer-api`
- `groweasy-csv-importer-web`

### Deploy steps

1. Push this repository to GitHub.
2. In Render, choose **New +** > **Blueprint**.
3. Select this repository.
4. Render will detect `render.yaml` and create both services.
5. Set `OPENAI_API_KEY` for the backend service when prompted.
6. Deploy.

The frontend calls the backend through an internal Render network host, so no extra public API URL wiring is needed in production.

## Submission checklist

Before emailing `varun@groweasy.ai`, include:

- Hosted application URL
- Public GitHub repository URL
- Position applied for:
  - Software Developer Intern, or
  - Software Developer (Full-Time)
