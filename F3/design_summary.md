# Transpose: Design Summary

### How the concepts work together

When a user pastes a link, **SongRegistering** records it and **SongTransposing** finds the same song on the other platform, so each song only has to be matched once and is reused by everyone afterwards. **Playlisting** stores playlists of these songs, and **PlaylistSharing** is checked before every edit so that only members with the right permissions can add or remove them. When a user plays a song, Transpose looks up their preferred platform and sends them to the matching link from SongTransposing. Together, this lets friends on different platforms build one playlist and each listen to it on their own service.

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
