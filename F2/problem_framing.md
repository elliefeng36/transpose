# Transpose: Problem Framing

## Domain

_An explanation of the domain, or general area, in which the problem lies._

As of 2025, Spotify consisted of 31.4% of global music subscriptions, Apple Music of 12.6%, and YouTube Music of 12.4% ([Source](https://www.chartlex.com/blog/business/music-streaming-market-share-2026)). In 2026, 32% of the US population listened to Spotify, 23% to YouTube Music, 12% to Apple Music, and 12% to Pandora ([Source](https://www.edisonresearch.com/wp-content/uploads/2026/03/The-Infinite-Dial-2026-Presentation.pdf)).

![alt text](image-1.png)
[Source](https://www.edisonresearch.com/wp-content/uploads/2026/03/The-Infinite-Dial-2026-Presentation.pdf)

But sharing music across platforms is highly inconvenient: most users listen to music through playlists, and it is highly difficult to share a Spotify playlist, for instance, with someone who does not use Spotify. In fact, someone is unable to listen to a Spotify playlist at all unless they get a Spotify account, and even if they do make an account, they're unable to even choose the order in which to play the music in a playlist ([Source](https://community.spotify.com/forum/en/discussion/5268490/share-spotify-playlist-to-non-spotify-user)).

Since no music platform fully dominates the whole population, friends often end up using different music platforms, so it's difficult to share music with friends.

## Bad situations

_One or more bad situations that arise in the domain and that call for a design intervention._

Music is a powerful tool for connection, and being unable to share music effectively removes that tool from us.

This bad situation affects me personally, as well. My family has YouTube Premium, while many of my friends have Spotify Premium. None of us are willing to switch platforms because it’s cheaper and more convenient to stick with what we currently have. After all, family plans are far cheaper than individual plans, and if I were to switch platforms, I'd also want to convince my entire family to switch platforms, too--a task that's far easier said than done.

## Evidence

_Evidence to corroborate the claim that the bad situations are impactful._

## Workarounds and comparables

_Workarounds that people currently use to mitigate the bad situations, and comparable solutions if they exist._

- [TuneMyMusic](https://www.tunemymusic.com/) -- a third-party website that allows you to transfer your music library from any music service to any other you want! Supports Spotify, TIDAL, Apple Music, YouTube, Amazon Music, Deezer and many more.
- [Soundiiz](https://soundiiz.com/) -- another, similar third-party website for transferring music from one platform to another

The main thing that differs between what we're suggesting and what these websites above solve is the following: our solution creates a way for friends to collaboratively build up a playlist, while the solutions above are more about one-time transfers from one platform to another, or one-time sharing of music.

## Solution sketch

_An outline of a solution._

## Ethical analysis

_An identification of stakeholders and the impacts they might experience in the short and long term._

The stakeholders of our project include:
1. Anyone who wants to build playlists with friends or family who use different streaming platforms. In the short term, these people can share music with each other without anyone having to switch platforms. However, they may experience issues with mismatched songs across platforms. For example, an official song from Spotify might be matched to a cover or unofficial upload in YouTube, so the playlist doesn’t sound the same for everyone. Users are also required to share their Spotify or YouTube listening data with our app. In the long term, this data accumulates, which could lead to privacy issues if our app is not secure. Another long term issue is platform dependency -- given that our app relies on the Spotify and YouTube APIs, if one of those APIs were to be restricted, users could potentially lose their playlists if they don’t export them.

2. Artists whose music is available on any of the streaming platforms we are integrating. In the short term, their music being shared cross-platform means more listeners. However, going back to the issue of mismatched songs, an artist loses a stream whenever an official release from Spotify matches with an unofficial release from YouTube, for example. In the long term, if this happens consistently, artists could lose the proper credit or monetization for their music.

3. Streaming platforms that we are integrating. In the short term, a playlist that would have kept a whole friend group on one platform now has its streams split across competitors. In the long term, users of our app are less incentivized to switch to or stay on a platform just because their friends use it, because they can use Transpose to convert shared music to the platform they’re already comfortable with.