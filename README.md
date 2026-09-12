# Anandu R Krishnan — portfolio site

A single-page portfolio for a video editor, cinematographer and colourist. The Portfolio section is
built entirely from `projects.json`, so adding new work never means touching
HTML, CSS or JavaScript.

Vanilla JS + HTML5 + Tailwind (CDN). No build step, no dependencies to install.

---

## File structure

```
storycraft-portfolio/
├── index.html              ← page structure + Tailwind theme config
├── projects.json           ← ★ the only file you edit to add work
├── README.md
│
├── css/
│   └── styles.css          ← design system, grid, modal, animations
│
├── js/
│   └── script.js           ← fetches the JSON, builds the grid, runs the player
│
└── assets/
    ├── thumbnails/         ← ★ drop project thumbnails here
    │   └── one .svg placeholder per project (replace with your stills)
    ├── video/              ← optional: showreel-loop.mp4, self-hosted films
    └── img/
        ├── portrait.jpg    ← your photo for the About section
        ├── hero-poster.jpg ← still shown before the hero video loads
        └── favicon.svg
```

---

## What still needs your input

The twelve projects, all the write-ups, your service list and your contact
details are already in, carried over from the Wix site. Three things I couldn't
fetch for you:

1. **Video links.** Every project has `"videoUrl": ""`. Clicking a card opens
   the player with a "video coming soon" note until you paste the real link.
   This is the highest-value thing to fix — the site is a portfolio without
   working video only in name.
2. **Thumbnails.** Each project has a colour-coded placeholder so the grid looks
   complete. Replace them with real stills from each piece.
3. **Social handles.** The links say `YOUR_HANDLE`. Worth noting: the social
   icons on your Wix site currently point at Wix's own Facebook, Instagram,
   X and TikTok accounts, not yours — so those need finding fresh.

Also double-check the email. Your Wix footer shows `Storycraftcreatives@gmail`
with no `.com`; I've assumed `storycraftcreatives@gmail.com`.

## Running it locally

The page loads `projects.json` with `fetch()`, and browsers block that on
`file://` — so **double-clicking `index.html` will show an error box**. You need
a local server. Any one of these, run from inside the project folder:

```bash
# Python (already on macOS and most Linux machines)
python3 -m http.server 5173

# Node
npx serve .
```

Then open **http://localhost:5173**.

If you use VS Code, the *Live Server* extension does the same thing — right-click
`index.html` → "Open with Live Server".

---

## Adding a new project

Two steps, every time.

**1. Drop the thumbnail** into `assets/thumbnails/`. Name it something you'll
recognise, e.g. `nikhil-wedding.jpg`. Landscape stills work best at 1600×900,
vertical ones at 900×1600.

**2. Add one block to `projects.json`**, inside the square brackets, separated
from the previous block by a comma:

```json
{
  "id": "nikhil-wedding",
  "title": "Nikhil & Sara",
  "client": "Private commission",
  "category": "Videography",
  "description": "One line about the shoot — this shows in the player.",
  "year": 2026,
  "duration": "3:40",
  "orientation": "landscape",
  "role": "Shot & edited",
  "thumbnail": "assets/thumbnails/nikhil-wedding.jpg",
  "videoUrl": "https://youtu.be/YOUR_VIDEO_ID",
  "featured": false
}
```

Save, refresh the page. That's it.

### What each field does

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Any unique text. Not shown on the page. |
| `title` | yes | Shown on the card and in the player. |
| `client` | no | Shown under the title. |
| `category` | yes | **Creates its own filter button automatically.** See below. |
| `description` | no | Shown under the video in the player. |
| `year` | no | Shown next to the client. |
| `duration` | no | Small badge on the thumbnail, e.g. `"2:14"`. |
| `orientation` | no | `"landscape"` (default) or `"portrait"` for reels — controls the card *and* player shape. |
| `role` | no | e.g. `"Editor & colourist"`. |
| `thumbnail` | yes | Path from the project root. |
| `videoUrl` | yes | See below. |
| `featured` | no | Reserved for future use; harmless to leave in. |

### Categories and filters

The filter buttons are generated from whatever `category` values exist in the
file, sorted alphabetically, with a count. Right now that gives you
**All (12) · Brand Films (3) · Events (1) · Reels (8)**.

Type `"category": "Photography"` on a project and a Photography button appears by itself.
Remove the last project in a category and its button disappears. No code change
either way.

### Video links

Paste the normal share link. The player works out the rest:

- `https://youtu.be/abc123` or `https://www.youtube.com/watch?v=abc123`
- `https://www.youtube.com/shorts/abc123`
- `https://vimeo.com/123456789`
- `assets/video/my-film.mp4` — a file you host yourself

Anything else opens in a new tab rather than embedding.

---

## The other things you'll want to change

Search `index.html` for these; they're all plain text.

- **Name, tagline, hero copy** — the `<section id="home">` block.
- **About text and the four numbers** — `<section id="about">`. The numbers live
  in `data-count="140"` and count up when scrolled into view.
- **Email, WhatsApp, location** — the `.contact-row` links.
- **Social links** — the `.social` anchors. Delete any you don't use; the row
  reflows on its own.
- **Colours** — the `tailwind.config` block near the top of `index.html`, and
  the `:root` variables at the top of `css/styles.css`. Change both to keep them
  in sync. Current palette: ink `#0E1415`, signal teal `#4DB6C4` (your existing
  Storycraft brand colour), tungsten `#E8B86D`.
- **Showreel** — `CONFIG.showreelUrl` at the top of `js/script.js` drives the
  "Watch the showreel" button. It's empty right now.
- **Social handles** — the `.social` links still say `YOUR_HANDLE`. Your Wix
  site's social icons point at Wix's own accounts, not yours, so these need
  your real profile URLs.

### The hero background video

Drop a short, quiet, muted loop at `assets/video/showreel-loop.mp4` — roughly
10–20 seconds, and keep it under about 5 MB or mobile visitors will wait. Export
at 1920×1080, no audio track.

If that file doesn't exist, the hero falls back to a slow teal-and-amber gradient
drift, which is why the page looks finished right now with no video at all.

---

## Making the contact form actually send

Static sites can't send email on their own. The form currently opens the
visitor's mail app as a fallback. To get real submissions in your inbox:

1. Sign up at [formspree.io](https://formspree.io) (free tier is fine) and
   create a form.
2. Copy your form ID and replace `FORM_ID` in `index.html`:
   ```html
   <form ... action="https://formspree.io/f/xyzabcde" method="POST">
   ```

The JS detects the change and switches to a proper background submit with
success and error messages. Netlify Forms or Getform work the same way.

---

## Putting it online

It's a plain static site, so any of these work with zero configuration:

- **Netlify** — drag the whole folder onto app.netlify.com/drop.
- **Vercel** — `npx vercel` from inside the folder.
- **GitHub Pages** — push the folder to a repo, then Settings → Pages → deploy
  from branch.
- **Cloudflare Pages** — connect the repo, leave the build command empty.

Before you publish, replace `assets/img/og-cover.jpg` (1200×630) so the link
preview looks right when someone shares it on WhatsApp or Instagram.

---

## Notes

- Tailwind is loaded from the Play CDN, which compiles classes in the browser.
  Perfect for a personal site. If the page ever grows large, switch to the
  Tailwind CLI to ship a compiled stylesheet instead.
- Keyboard navigation, visible focus rings, and `prefers-reduced-motion` are all
  handled — animations switch off for visitors who've asked for that.
- The grid uses CSS columns, so portrait reels and landscape films pack together
  without gaps.
