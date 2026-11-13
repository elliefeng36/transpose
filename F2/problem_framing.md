# Transpose: Problem Framing

## **Domain**

Friends frequently use music to spend time and connect together. For instance, they might build a playlist for a road trip or a party, or trade songs to communicate thoughts and feelings. Most of this—searching for songs, saving them to playlists, and sharing songs with friends—happens inside a streaming service, like Spotify, YouTube Music, or Apple Music.

As of 2025, Spotify consisted of 31.4% of global music subscriptions, Apple Music of 12.6%, and YouTube Music of 12.4% ([Source](https://www.chartlex.com/blog/business/music-streaming-market-share-2026)). Meanwhile, for the US population, in 2026, 32% of the US population listened to Spotify, 23% to YouTube Music, 12% to Apple Music, and 12% to Pandora ([Source](https://www.edisonresearch.com/wp-content/uploads/2026/03/The-Infinite-Dial-2026-Presentation.pdf)). While the proportion of music streamers differs between different populations, overall, the music streaming market is clearly quite fractured between the main music providers.

![alt text](image-1.png)

[Source](https://www.edisonresearch.com/wp-content/uploads/2026/03/The-Infinite-Dial-2026-Presentation.pdf)

But sharing music across platforms is highly inconvenient: most users listen to music through playlists, and it is highly difficult to share a Spotify playlist, for instance, with someone who does not use Spotify. In fact, someone is unable to listen to a Spotify playlist at all unless they get a Spotify account, and even if they do make an account, they're unable to even choose the order in which to play the music in a playlist ([Source](https://community.spotify.com/forum/en/discussion/5268490/share-spotify-playlist-to-non-spotify-user)).

Since no music platform fully dominates the whole population, friends often end up using different music platforms, so it's difficult to share music or make playlists with friends. Notably, there’s also a lot of friction to switching platforms, since a streaming service contains all your playlists and listening history.

Music is a powerful tool for connection, and being unable to share and, more importantly, collaborate through music effectively removes that tool from us.

## **Bad situations**

My family has YouTube Premium, while many of my friends have Spotify Premium. None of us are willing to switch platforms because it’s cheaper and more convenient to stick with what we currently have. After all, family plans are far cheaper than individual plans, and if I were to switch platforms, I'd also want to convince my entire family to switch platforms, too--a task that's far easier said than done.

If a group of friends who use different music streaming platforms wants to go on a road trip and collaborate on a group playlist for it, then they would have to pick one platform to host the playlist, and anyone who used a different platform wouldn’t be able to directly contribute. This is unfair and may feel exclusionary. The workaround, which is telling someone with the right platform what songs to add, is unwieldy and annoying, especially if the playlist is meant to be very long.

## **Evidence**

Spotify Jam and Apple Music’s SharePlay are two extremely popular services that allow users to live-collaborate on playlists: Spotify Jam has over 100 million monthly listening hours ([Source](https://newsroom.spotify.com/2025-08-25/jam-reaches-100-million-monthly-listening-hours/)). This gives evidence that being able to share and build playlists with other people is very important to people and further highlights the bad situation of being unable to do so across platforms.

Furthermore, there already exist popular third-party websites such as TuneMyMusic (which we will discuss below) that can transfer music libraries between different music services. According to its website, TuneMyMusic transfers 341 million tracks a week, showing just how pervasive the need to share music between different platforms is.

Altogether, we can see that within platforms, the ability to collaborate on playlists is widely used and very popular, and we also see that there is high demand for transferring music between different services. So, being able to collaborate on playlists cross-platform fulfills the need that bridges the gap between these two demands.

## **Workarounds**

- Relaying songs through a friend: if Alice, who’s on YouTube Music, wants to add a song to a Spotify playlist, she has to ask a Spotify user to relay the song for her to the owner of that playlist. But that’s slow and inconvenient.
- Joining the other platform: a user might also make an account on the other platform. But there’s a lot of friction involved in switching platforms since a user’s history and library remains on the previous platform, and if they only make a free account, they’ll be met with ads and playback limits.

## **Comparable Solutions**

- Every streaming service has native collaborative playlists: for instance, Spotify and Apple Music have Spotify Jam and SharePlay. The experience through these solutions is extremely positive, but they only work when everyone is on the same platform. We’ll draw on these existing native experiences in our solution, adapted to a cross-platform surface.
- [TuneMyMusic](https://www.tunemymusic.com/) and [Soundiiz](https://soundiiz.com/) are third-party websites that allow users to transfer their music library from any music service to any other service they might prefer. They support Spotify, TIDAL, Apple Music, YouTube, Amazon Music, Deezer and many more. However, there’s no way for multiple users on different platforms to create a single shared playlist that they can add to and from their own service.
- [Odesli](https://odesli.co/) is a service that creates smart links for music and podcasts: it generates a single, shareable web page with direct links to a song, album, or podcast across multiple streaming platforms. This solves cross-platform sharing for a single song, but it has no playlists or collaboration.

Our project is going to combine the strengths in all of these current solutions. Just like Spotify Jam, friend groups will be able to live-collaborate on building one playlist together. But like song.link, Transpose is cross-platform, with a single identity for each song rather than the same song being scattered across different platforms. Overall, our solution creates a way for friends to collaboratively build up a playlist cross-platform.

## **Solution sketch**

Our solution is to create a cross-platform playlist app called Transpose. When building a Transpose playlist, a user can add either the Spotify or YouTube link, and Transpose will find the corresponding link on the other platform. This allows users from different platforms to create playlists together on Transpose. A user can then set their preferred platform in their account, and Transpose will automatically route a user to that platform and play the corresponding songs.

For now, we will focus on integrating Spotify and YouTube Music, as these two platforms are two of the most prevalent ones, especially in our (the creators’) generation. Additionally, the API endpoints for Spotify and YouTube are the most accessible. Apple Music integration would require a \$99/year developer membership fee.

Below is a more specific picture of what our solution will look like:

Yasmin is a Youtube Music user, and Sasha is a Spotify user. Yasmin and Sasha want to collaborate on a playlist for their trip to Europe, so they create accounts on Transpose. Sasha creates an empty playlist in Transpose, titled “Europe trip\!”, and shares it with Yasmin. Sasha wants to add “Mr. Brightside” to the playlist. Because no one else has added “Mr. Brightside” to any playlist in Transpose yet, Transpose doesn’t yet have that song in its database, so she has to manually add “Mr. Brightside.” That is, she enters the “add song” interface, where she inputs the Spotify link. She’s able to also input the YouTube Music link, but for convenience, she can just ask the app to automatically look the link up based on the Spotify link she inputted.

Yasmin wants to add “All Too Well” to the playlist. She looks up “All Too Well” inside the Transpose app, and since someone else has added “All Too Well” to another Transpose playlist, Transpose already has “All Too Well” in its database, and she’s able to add “All Too Well” directly. However, she decides that she wants a specific remix of “All Too Well” rather than the version of “All Too Well” that already exists in Transpose, so she inputs the specific YouTube and Spotify links that correspond to the version of the song that she’s looking for. This creates a new “All Too Well” version in the Transpose database. From this point on, if some other user, Oswold, wanted to add “All Too Well” to his playlist, he would be able to add either “All Too Well” version in the Transpose database into the playlist, or he could manually input a song himself, as well.

Once Yasmin and Sasha have added some songs to their shared playlist, they can listen to it on their trip\! While driving through the fjords of Norway, Yasmin could play the playlist on Transpose, and it’ll automatically route them to Yasmin’s preferred platform (YouTube Music). If Sasha wants to add a new song to the playlist, it’ll appear in the playlist immediately.

And when Yasmin’s phone runs out of battery, Sasha can take over and play the exact same playlist, except it’s on her preferred platform instead.

If Yasmin and Sasha don’t have signal in the fjords of Norway, they can also export the playlist from Transpose to their preferred platform before the trip and download the playlist on their preferred platform, although in that case, updates to the playlist in Transpose will not update the playlist they downloaded in their preferred platform unless they export the playlist to their preferred platform again.

## **Ethical analysis**

1. ### Artists might lose credit because of bad matches.

**Observation:** Artists are not users of Transpose, but they are indirect stakeholders of Transpose. Automatic link matching might have a negative effect on artists if our app were to mismatch songs. In particular, an artist might lose a stream whenever an official release from Spotify matches with an unofficial release from YouTube, for example. In the long term, if this happens consistently, artists could lose the proper credit or monetization for their music.

**Design Response:** Therefore, we’ll adjust our design: during automatic matching, we’ll make sure to preference official uploads and verified artist channels.

2. ### Open editing vs. ownership

**Observation:** Letting anyone in a group edit ensures that we’re including and being fair to everyone, but it conflicts with ownership. In particular, a member might delete or reorder songs without letting others know, which would be undesirable.

**Design Response:** Therefore, we’re planning to add a playlist history feature that shows who added, removed, or rearranged each song. We will also add tiered permissions, where the playlist creator will be able to choose which members are allowed to add or remove which songs.

3. ### Convenience vs. privacy

**Observation:** The most direct stakeholder in this case is anyone who wants to build playlists with friends or family who use different streaming platforms. In the short term, Transpose is highly convenient and useful for these stakeholders, as they can share music with each other without anyone having to switch platforms. However, users are required to share their Spotify or YouTube listening data with our app. In the long term, this data accumulates, which could lead to privacy issues if our app is not secure.

**Design Response:** We will thus add some limits to our design: we’ll only request the permissions we actually need and we won’t store listening history. Additionally, we’ll allow users to use Transpose without linking an account by allowing users to directly open songs through links, instead.

4. ### Playlists stranded if the app goes away

**Observation:** Given that our app relies on the Spotify and YouTube APIs, if one of those APIs were to be restricted, users could potentially lose their playlists if they don’t export them. Additionally, this is a student project, so it may stop being maintained. Either way, playlists that only exist inside Transpose could be lost.

**Design Response:** That’s why we’re adding the ability to let users export a Transpose playlist to their own platform. Additionally, if we discover that the APIs will be restricted or decide to shut the app down, we will warn users before doing so.

5. ### Weakening platform lock-in

**Observation:** If Transpose becomes widely adopted, that weakens the pressure for friends to all share one service. This benefits the listeners, since they can choose the platform with their favorite price or features, but platforms lose lock-in and might even restrict API access as a response.

**Design Response:** However, since our design is limited to playing back music on the original platforms, each platform will still earn from streams.

Additionally, it is known that Spotify actually officially approves of and integrates TuneMyMusic directly into its platform ([Source](https://www.spotify.com/us/import-music/)). Since much of our solution resembles the idea behind TuneMyMusic, we expect that streaming services will not be too strongly against it.
