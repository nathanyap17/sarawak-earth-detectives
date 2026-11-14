# CREDENTIALS.md — names and locations only, NEVER values

## Environment variables
| Variable | Used by | Where it lives | Notes |
|---|---|---|---|
| APP_ENV | backend | `.env` / Cloud Run env | local or cloud |
| ALLOWED_ORIGINS | backend | `.env` / Cloud Run env | Comma-separated; the Hosting URL in the cloud |
| DATA_BACKEND | backend | `.env` / Cloud Run env | local or gcs |
| GCS_BUCKET | backend | Cloud Run env | Vault bucket name |
| GOOGLE_GENAI_USE_VERTEXAI | ADK | `.env` / Cloud Run env | TRUE |
| GOOGLE_CLOUD_PROJECT | ADK, Firestore | `.env` / Cloud Run env | GCP project id |
| GOOGLE_CLOUD_LOCATION | ADK | `.env` / Cloud Run env | asia-southeast1 (confirm model availability, EXP-6) |
| MODEL_NAME | agents | `.env` / Cloud Run env | A Gemini model enabled in the project |
| MOCK_AGENTS | agents | `.env` | 1 = canned replies, no Vertex calls |
| FIRMS_MAP_KEY | ingest only | `.env`; Secret Manager if ingest runs in the cloud | Free key from FIRMS |
| EARTHDATA_TOKEN | ingest only | `.env`; Secret Manager if needed | NASA Earthdata login token |
| VITE_API_BASE | frontend | `frontend/.env.local` / build env | Backend URL |
| VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID | frontend | `frontend/.env.local` | Firebase web config (public by design, still untracked) |
| (ADC) | backend, local | `gcloud auth application-default login` | Nathan runs it |

## Accounts needed
| Account | Owner | Status |
|---|---|---|
| Google Cloud project with billing and Vertex AI | Nathan | TODO |
| Firebase project (Hosting, anonymous Auth, Firestore) linked to the GCP project | Nathan | TODO |
| NASA Earthdata login | Nathan | TODO |
| FIRMS map key | Nathan | TODO |
| GitHub repository | Nathan | See WORKSPACE_SETUP |

## Deployed URLs
| Environment | URL | Notes |
|---|---|---|
| Frontend (Firebase Hosting) | TODO | Must open with no login |
| Backend (Cloud Run) | TODO | `--allow-unauthenticated`; CORS limited to the Hosting origin |

## Post-deploy checklist
1. Open the Hosting URL in a private window: it lands in the office with no login.
2. `GET /health` on Cloud Run returns `env: cloud`.
3. Solve case 001 end to end.
4. A budget alert is set on the GCP project.
