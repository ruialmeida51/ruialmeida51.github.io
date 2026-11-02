# ruialmeida51.github.io

My living CV: work, side projects, and the stuff I do off the clock. Live at [eyther.dev](https://eyther.dev).

Plain HTML/CSS/JS, no build step. The only exception is `/blog`, which GitHub Pages builds with Jekyll.

- `assets/js/now.js`: the "Currently" strip and the WoW countdown date
- `grind/`: The Grind skill tree (page, styles, script). `grind/progress.json` is the only file that changes: topics plus one entry per session (date, type, topic, confidence, result). Only public-safe data goes in it.
- `blog/`, `_layouts/`, `_posts/`, `_drafts/`, `_config.yml`: the hand-written blog (Jekyll, built by GitHub Pages). See `WRITING.md`.
- `index.html`: all other content
