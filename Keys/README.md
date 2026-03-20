# Google Cloud credentials (Docker)

Place your service account JSON here as `google.json` (or set `GOOGLE_APPLICATION_CREDENTIALS` in `.env` to another path).

The backend container mounts this directory at `/app/keys` read-only. Default env:

`GOOGLE_APPLICATION_CREDENTIALS=/app/keys/google.json`

Do **not** commit real keys to git.
