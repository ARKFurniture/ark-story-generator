[README.md](https://github.com/user-attachments/files/24460816/README.md)
# ARK Story Generator — Fly.io Deploy

This repo is a static web app (HTML/CSS/JS) packaged with Nginx for easy deployment on Fly.io.

## Local run (Docker)
```bash
docker build -t ark-story .
docker run --rm -p 8080:8080 ark-story
```
Open: http://localhost:8080

## Deploy to Fly.io (manual)
Prereqs:
- Fly account
- `flyctl` installed
- A GitHub repo (optional but recommended)

### 1) Create a new Fly app name (or edit `fly.toml`)
App names must be globally unique. Replace `app = "ark-story-generator"` with your preferred name.

### 2) Login and deploy
```bash
fly auth login
fly launch --no-deploy
fly deploy
```

### 3) Open your deployed app
```bash
fly open
```

## Deploy from GitHub (recommended)
You can deploy automatically on pushes to `main` via GitHub Actions.

### 1) Add a Fly API token to GitHub
- In Fly: create a token:
```bash
fly tokens create
```
- In GitHub repo settings → Secrets and variables → Actions → New repository secret:
  - Name: `FLY_API_TOKEN`
  - Value: (the token)

### 2) Add the workflow file
Create: `.github/workflows/fly-deploy.yml` with the contents below (also included in this repo).

Now every push to `main` deploys.

## Notes
- The app runs on port 8080 inside the Fly machine (matches nginx.conf and fly.toml).
- Google Font is loaded from Google; if you want it 100% offline, we can bundle the font files locally.
