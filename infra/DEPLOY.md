# DEPLOY.md: first deploy (Phase 4, Gate 3)

Nathan runs every command. Run them from the repository root in Git Bash, with the gcloud configuration `sed` active.
Values here are ids and URLs, not secrets.

## 0. Before deploying
```bash
cd backend && uv run pytest -q && cd ..        # rule 8: known-answer tests must pass
ls data/vault/index.json data/vault/answer_keys # the vault is baked into the image
```
No Firebase sign-in step: the app uses nicknames only and has no Firebase Auth code, so the public link opens with no login as it is. (Corrected 2026-11-14; an earlier version asked to enable Anonymous sign-in.)

## 1. A service account for the API (once)
```bash
gcloud iam service-accounts create sed-api --display-name="Sarawak Earth Detectives API"
gcloud projects add-iam-policy-binding ssc-workspace-2026 --member="serviceAccount:sed-api@ssc-workspace-2026.iam.gserviceaccount.com" --role="roles/aiplatform.user" --condition=None
gcloud projects add-iam-policy-binding ssc-workspace-2026 --member="serviceAccount:sed-api@ssc-workspace-2026.iam.gserviceaccount.com" --role="roles/datastore.user" --condition=None
```

## 2. Backend → Cloud Run
`^@^` makes `@` the separator, so the comma inside ALLOWED_ORIGINS survives.
```bash
gcloud run deploy sed-api --source . --region asia-southeast1 --service-account sed-api@ssc-workspace-2026.iam.gserviceaccount.com --allow-unauthenticated --memory 1Gi --cpu 1 --cpu-boost --min-instances 1 --max-instances 3 --concurrency 40 --timeout 60 --set-env-vars "^@^APP_ENV=cloud@SESSION_BACKEND=firestore@GOOGLE_GENAI_USE_VERTEXAI=TRUE@GOOGLE_CLOUD_PROJECT=ssc-workspace-2026@GOOGLE_CLOUD_LOCATION=global@MODEL_NAME=gemini-3.5-flash-lite@ALLOWED_ORIGINS=https://ssc-workspace-2026.web.app,https://ssc-workspace-2026.firebaseapp.com"
```
- If it asks to create an Artifact Registry repository `cloud-run-source-deploy`, answer **Y**.
- If the build fails with a permission error for the Compute Engine default service account, run this, then deploy again:
  `gcloud projects add-iam-policy-binding ssc-workspace-2026 --member="serviceAccount:1054650249606-compute@developer.gserviceaccount.com" --role="roles/run.builder" --condition=None`
- `--min-instances 1` keeps one warm instance during judging (the model's first call takes 10–27 s). Drop it to 0 after the event.

Check it:
```bash
URL=$(gcloud run services describe sed-api --region asia-southeast1 --format='value(status.url)'); echo $URL
curl -s $URL/health
curl -s $URL/vault/health | head -c 300
```
`/health` must say `"env":"cloud"`, `"sessions":"firestore"`, `"mock_agents":false`.

## 3. Frontend → Firebase Hosting
```bash
echo "VITE_API_BASE=$URL" > frontend/.env.production.local
cd frontend && npm run build && cd ..
firebase deploy --only hosting,firestore:rules --project ssc-workspace-2026
```
`frontend/.env.production.local` is gitignored. Vite merges it with `.env.local` (the Firebase web config).

## 4. Gate 3 check
1. Open https://ssc-workspace-2026.web.app in a **private window**: the office opens with no login.
2. Solve case 001 end to end; ask the Partner for a hint; read the Chief's note.
3. Firestore console → `sessions`: one document per run, with a nickname and no other personal data.
4. Set a budget alert: Billing → Budgets & alerts → RM 50, alerts at 50/90/100%.

## Redeploy
Backend: the same `gcloud run deploy` command. Frontend: `npm run build` then `firebase deploy --only hosting`.
