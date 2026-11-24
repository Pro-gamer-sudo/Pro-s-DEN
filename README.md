# The Thinker's Journal — v2

A free, offline-first learning app for one evening at a time: 365 days, 45 minutes a day, six pillars, with references for every lesson. It installs on Android as a home-screen app.

## Install on an Android phone (free, about 5 minutes)

The app is a set of static files, so any free static host works. GitHub Pages is the easiest from a phone:

1. Sign in at github.com in Chrome and create a new **public** repository, e.g. `thinkers-journal`.
2. Tap **Add file → Upload files** and upload every file from this folder: `index.html`, `app.js`, `content.js`, `sw.js`, `manifest.webmanifest` and the three `icon-*.png` files.
3. Go to **Settings → Pages**. Under *Branch*, choose `main` and `/ (root)`, then **Save**.
4. After a minute, open `https://<your-username>.github.io/thinkers-journal/` in Chrome.
5. Chrome menu (⋮) → **Add to Home screen / Install app**.
6. Open it once while online. After that it works offline.

Netlify Drop or Cloudflare Pages work too. Upload the same files.

## Your data

- Progress, notes, cards and books are saved **on the phone**, as you go.
- **Progress → Backup (.json)** saves everything to a file. **Restore backup** merges a backup back in.
- **Progress → Export to Obsidian (.zip)** creates a vault: one note per day, month pages, a dashboard, books, references and flashcards (`question::answer`, the format the Obsidian Spaced Repetition plugin reads).
- **Optional free sync between phone and laptop:** Progress → Sync & backup → paste a GitHub token that has only the `gist` scope. Your data then lives in one private Gist. The token never leaves your device except to talk to GitHub.

## How a day works

| Step | Time | What you do |
|---|---|---|
| Deep learning | 15 min | Read the day's references |
| Explore | 10 min | Watch one video from the linked search |
| Practice | 10 min | Do the exercise and produce something |
| Reflect | 5 min | Write notes. They are saved to your Journal |
| Explain | 5 min | Say it out loud, then answer the recall question |

Press **Start** and the timer walks you through all five steps. It chimes between steps and keeps the screen awake. Completing a day turns its question into a spaced-repetition card in **Review**. Day 7 of every week is a recall quiz, and the end of every month has an output project and a self-assessment.

If you miss a day, the app simply waits on the lesson you haven't done. You never have to double up.
