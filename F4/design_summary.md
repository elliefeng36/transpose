# Transpose: Design Summary

### How the concepts work together

**Authenticating** registers accounts and verifies passwords. After sign-in, **Sessioning** issues a session, which Transpose uses to identify the person viewing or editing a playlist. When that person creates a playlist, **Playlisting** stores it and a reaction initializes its ownership in **PlaylistSharing**. The owner can invite friends by username. Friends who accept can view the playlist and add songs, and the owner can grant permission to remove songs separately.

When someone pastes a Spotify or YouTube link, **SongRegistering** records the song or reuses an existing record. If the song is missing a link for the other platform, a reaction asks **Matching** to find it and attaches the result to the same song record. If the search finds no match, the user can add the other link manually. Users can then select registered songs to add to a playlist. Transpose checks **PlaylistSharing** before letting a user view a shared playlist, add songs, or remove them.

Listeners can open the saved Spotify or YouTube links for an individual song. Anyone who can view a playlist can also choose Spotify or YouTube as an export destination. Transpose sends the current track list to Soundiiz, where the listener reviews the matches and finishes the transfer. Later edits to the shared playlist require a new export to appear in the destination copy.

### How the design addresses our ethical concerns

* **Artists losing credit from bad matches:** automatic matching will prioritize official uploads and verified artist channels. When a match is wrong or missing, users can paste the correct link themselves through the addVersion reactions.

* **Open editing vs. ownership:** PlaylistSharing gives each member separate canAdd and canRemove permissions that only the owner can change, and new members can add but not remove by default. Playlisting will keep a history of who added, removed, or reordered each song.

* **Convenience vs. privacy:** registering and matching songs only use the app’s own API credentials, and playing a song is a redirect to a link, so users can use Transpose without linking their streaming account. We don’t store listening history.

* **Stranded playlists:** playlists are stored in Transpose, not on either platform, so losing access to one API doesn’t delete them. Users can also export a playlist to their own platform, where it continues to exist natively.

* **Weakening platform lock-in:** all playback happens on the original platforms, so each platform still gets the streams.

### Issues that remain unclear

* **API limits.** Spotify limits apps in development mode to five authorized users, and YouTube allows about 100 searches a day by default. This means we should try to automate and store matches so that when a user looks up a song live, they don’t hit the API too many times.

* **Permission granularity.** Permissions are per member. We haven’t decided whether we also need per-song rules, like only letting members remove songs they added.

* **Invites.** Inviting by username means a friend needs an account before they can be invited. An invite link might be easier.
