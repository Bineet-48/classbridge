# ClassBridge

ClassBridge is a local full-stack prototype for online classes, paid tests, meeting admission, exam warnings, and homework assignments.

## Run

```powershell
npm start
```

Open:

```text
http://127.0.0.1:5173
```

## Demo Accounts

- Teacher: `Demo Sir`
- Student: `Demo Student`

Use the role selector in the top bar before clicking **Sign in**.

## Data

The backend stores local data in `data/db.json`. This is good for a prototype. A production version should use a real database, authentication, payment provider, and meeting provider.

## Deploy On Render

1. Create or open your GitHub account.
2. Create a new GitHub repository named `classbridge`.
3. Upload these project files and folders to that repository:
   - `assets/`
   - `data/`
   - `.gitignore`
   - `index.html`
   - `package.json`
   - `README.md`
   - `render.yaml`
   - `script.js`
   - `server.js`
   - `styles.css`
4. Create or open your Render account.
5. Choose **New +** then **Web Service**.
6. Connect your GitHub repository.
7. Use these settings:
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment: `Node`
   - Instance type: `Free`
8. Click **Deploy Web Service**.
9. When deployment finishes, Render gives a public URL.
