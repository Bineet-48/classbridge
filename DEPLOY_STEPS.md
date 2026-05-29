# Deploy ClassBridge Step By Step

## Part 1: Put The Code On GitHub

1. Go to `https://github.com`.
2. Sign in or create an account.
3. Click the `+` button in the top-right.
4. Click `New repository`.
5. Repository name: `classbridge`.
6. Choose `Public`.
7. Click `Create repository`.
8. Click `uploading an existing file`.
9. Drag these files/folders from this project folder into GitHub:
   - `assets`
   - `data`
   - `.gitignore`
   - `index.html`
   - `package.json`
   - `README.md`
   - `render.yaml`
   - `script.js`
   - `server.js`
   - `styles.css`
10. Click `Commit changes`.

## Part 2: Deploy On Render

1. Go to `https://render.com`.
2. Sign in with GitHub.
3. Click `New +`.
4. Click `Web Service`.
5. Select the `classbridge` repository.
6. Use these settings:
   - Name: `classbridge`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free`
7. Click `Deploy Web Service`.
8. Wait until it says `Live`.
9. Copy the public URL Render shows.
