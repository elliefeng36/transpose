# Embed test (F3.5)

A one-page test site for the "play music inside Transpose" pipeline. It embeds a Spotify player (Spotify iFrame API) and a YouTube player (YouTube IFrame Player API), lets you paste any track, playlist, or video link, and has a checklist for confirming that Premium users keep their perks (full Spotify tracks, no YouTube ads).

## Run it

It must be served from localhost. Opening `index.html` directly (file://) makes YouTube refuse to play.

```sh
cd F3.5
python3 -m http.server 8000
```

Then open http://localhost:8000 in each browser you want to test. Stop the server with Ctrl+C.

## What to test

The checklist and a results table are on the page itself. In short:

1. Logged out, Spotify plays 30-second previews and YouTube shows ads (baseline).
2. Logged in to Spotify Premium in the same browser, Spotify should play full tracks.
3. Signed in to YouTube Premium in the same browser, YouTube should play with no ads.
4. Repeat in Safari / Brave / Firefox, which block third-party cookies and may make the embeds act logged out.
5. Try the youtube-nocookie.com toggle and a YouTube Music Premium-only account if available.

Neither API reports ads or the user's plan to our code, so this has to be checked by eye. The Spotify status line flags previews (~30 s duration) automatically.
