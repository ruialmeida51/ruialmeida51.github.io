# Writing a post

The blog is 100% hand-written. The only AI involvement allowed is a grammar check, and the checker returns a list of corrections that I apply myself. It never rewrites sentences.

## Draft
1. Create `_drafts/my-title.md`. Anything in `_drafts/` is never published.
2. Start it with this front matter, then write in Markdown:

```
---
layout: post
title: "The title"
summary: "One line shown on the blog index."
grammar_checked: false
---
```

## Publish
1. Move the file to `_posts/YYYY-MM-DD-my-title.md` (the date in the name is the post date).
2. Set `grammar_checked: true` only if an AI checked it, which adds an honest line under the title.
3. Commit and push to `main`. GitHub Pages builds it in a minute or two.

Images go in `images/` and are linked as `/images/name.png`.
