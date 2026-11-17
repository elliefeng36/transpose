# Transpose: Concept Design and Rections

Our concepts are: SongRegistering, SongTransposing, PlaylistSharing, and Playlisting. 

### SongRegistering

**concept** SongRegistering

**purpose** Keeps a record of every song link users bring into the app, so that each track on each platform is represented exactly once.

**principle** When a user pastes a link to a song on Spotify or YouTube, the song is registered with its platform and basic details (e.g. who the artist is). If someone later pastes the same link, they get back the same song instead of a duplicate. Anyone can find the song by searching its title.

**state**
A set of Songs with\
&emsp;a songId String\
&emsp;a link String\
&emsp;a platform of SPOTIFY or YOUTUBE\
&emsp;a title String\
&emsp;an artist String

**actions** 

register(link: String): (song: Song)\
&emsp;**where** link is a valid Spotify or YouTube song link and no Song with the same songId exists\
&emsp;**then** calls the platform’s API to get the title and artist, creates a new Song with songId as the platform’s own track ID parsed from the link, and returns it

&emsp;**where** a Song with the same songId already exists\
&emsp;**then** returns the existing Song\

register(link: String): (error: String)\
&emsp;**where** link is not a valid Spotify or YouTube song link, or the platform’s API cannot find the track\
&emsp;**then** returns an error message

unregister(song: Song)\
&emsp;**where** song exists **then** removes song from the set of Songs

**queries**
_getSong(songId: String): (song: Song)\
&emsp;**where** a Song with songId exists **then** returns it\
_getDetails(song: Song): (link: String, platform: SPOTIFY or YOUTUBE, title: String, artist: String)\
&emsp;**where** song exists **then** returns its link, platform, title and artist\
_search(text: String): (songs: set of Songs)\
&emsp;**then** returns every Song whose title or artist contains text

### SongTransposing

**concept** SongTransposing[Song]

**purpose** Keeps tracks of links to the same songs on different platforms and transposes songs from one platform to another to allow users to find and listen to songs across platforms.

**principle** Given a song from one platform, returns the corresponding songs from the other platform. Users can also add alternate versions of a song as corresponding songs.

**state**
A set of Transpositions with\
&emsp;a unique songId String\
&emsp;a youtubeSongs set of Songs\
&emsp;a spotifySongs set of Songs

**actions**

transposeSong(song: Song): (transposedSongs: set of Songs)\
&emsp;**where** song’s platform is YOUTUBE\
&emsp;**then** calls toSpotify(song: Song) and returns the result

&emsp;**where** song’s platform is SPOTIFY\
&emsp;**then** calls toYoutube(song: Song) and returns the result

toSpotify(song: Song): (transposedSong: set of Songs)\
&emsp;**where** song’s platform is YOUTUBE and song’s songId exists as a songId in the set of Transpositions\
&emsp;**then** returns the corresponding Transposition’s spotifySongs\

&emsp;**where** song’s songId does not exist in the set of Transpositions\
&emsp;**then** makes a new Transposition with songId and youtubeSongs as the set containing this song. Calls the Spotify API to find an equivalent song and sets spotifySongs as the set containing the new song. Returns spotifySongs.

toYoutube(song: Song): (transposedSong: set of Songs)\
&emsp;**where** song’s platform is SPOTIFY and song’s songId exists as a songId in the set of Transpositions\
&emsp;**then** returns the corresponding Transposition’s spotifySongs

&emsp;**where** song’s songId does not exist in the set of Transpositions\
&emsp;**then** makes a new Transposition with songId, spotifySongs as the set containing the song. Calls the Youtube API to find an equivalent song and sets youtubeSongs as the set containing the new song. Returns youtubeSongs.

addAlternateVersion(song: Song):\
&emsp;**where** song’s songId exists as a songId in the set of Transpositions and song’s platform is YOUTUBE\
&emsp;**then** add song to youtubeSongs in the corresponding Transposition

&emsp;**where**  song’s songId exists as a songId in the set of Transpositions and song’s platform is SPOTIFY\
&emsp;**then** add song to spotifySongs in the corresponding Transposition

**queries**

_viewTransposition(songId: String): (youtubeSongs: set of Songs, spotifySongs: set of Songs)\
&emsp;**where** songId exists as a songId in the set of Transpositions\
&emsp;**then** return that Transposition’s youtubeSongs and spotifySongs


### PlaylistSharing

**concept** PlaylistSharing[User, Playlist]

**purpose** Lets the owner of a playlist give other people access to it and control what each of them can do, so that friends can build it together.

**principle** After a user creates a playlist, they become its owner. The owner invites a friend, and once the friend accepts, the friend becomes a member who can view the playlist and add songs to it. The owner can then change what each member is allowed to do, for instance letting one friend remove songs but not another, and can remove a member at any time.

**state**
A set of Shares with\
&emsp;a playlist Playlist\
&emsp;an owner User\
A set of Memberships with\
&emsp;a playlist Playlist\
&emsp;a member User\
&emsp;a canAdd Flag\
&emsp;a canRemove Flag\
A set of Invites with\
&emsp;a playlist Playlist\
&emsp;an inviter User\
&emsp;an invitee User

**actions**

startSharing(playlist: Playlist, owner: User)\
&emsp;**where** no Share exists for playlist\
&emsp;**then** creates a Share with playlist and owner

invite(playlist: Playlist, inviter: User, invitee: User): (invite: Invite)\
&emsp;**where** a Share exists for playlist, inviter is its owner, invitee is not the owner and has no Membership for playlist, and no Invite exists for the same playlist and invitee\
&emsp;**then** creates an Invite and returns it

accept(invite: Invite)
&emsp;**where** invite exists\
&emsp;**then** creates a Membership for the invite's playlist and invitee with canAdd true and canRemove false, and removes the invite

decline(invite: Invite)\
&emsp;**where** invite exists **then** removes the invite

setPermissions(playlist: Playlist, owner: User, member: User, canAdd: Flag, canRemove: Flag)\
&emsp;**where** a Share exists for playlist with this owner and member has a Membership for playlist
&emsp;**then** sets that Membership's canAdd and canRemove

removeMember(playlist: Playlist, owner: User, member: User)\
&emsp;**where** a Share exists for playlist with this owner and member has a Membership for playlist\
&emsp;**then** removes that Membership

leave(playlist: Playlist, member: User)\
&emsp;**where** member has a Membership for playlist\
&emsp;**then** removes that Membership

stopSharing(playlist: Playlist)\
&emsp;**where** a Share exists for playlist\
&emsp;**then** removes the Share and all Memberships and Invites for playlist

**queries**

_canView(playlist: Playlist, user: User): (allowed: Flag)\
&emsp;**then** yields true if user corresponds to the Share owner or holds an active Membership

_canAdd(playlist: Playlist, user: User): (allowed: Flag)\
&emsp;**then** yields true if user is owner or maintains a Membership with canAdd active

_canRemove(playlist: Playlist, user: User): (allowed: Flag)\
&emsp;**then** yields true if user is owner or maintains a Membership with canRemove active

_getMembers(playlist: Playlist): (owner: User, memberships: set of Memberships)\
&emsp;**where** a Share exists for playlist **then** provides its owner along with all associated Memberships

_getInvites(invitee: User): (invites: set of Invites)\
&emsp;**then** retrieves all Invites targeted to invitee

_getSharedPlaylists(user: User): (playlists: set of Playlists)\
&emsp;**then** yields all playlists where user acts as owner or retains Membership

### Playlisting
**concept** Playlisting

**purpose** Store songs, allowing different users to add to and delete songs from them.

**principle** A user creates a playlist and becomes its owner. Other users, which may or may not include the playlist owner, can then add or remove songs from the playlist freely.

**state**
A set of Playlists with\
&emsp;an owner User\
&emsp;a title String\
&emsp;a set of Songs

**actions**

create(title: String, owner: User) : (playlist: Playlist):\
&emsp;**where** a playlist does not already exist with this title\
&emsp;**then** create a playlist with this title, assigned to this User, and return it

addSong(playlist: Playlist, song: Song, user: User)\
&emsp;**where** this song does not already exist in this playlist\
&emsp;**then** add this song to the Playlist, assigned to this User

removeSong(playlist: Playlist, song: Song)\
&emsp;**where** this song exists in this playlist\
&emsp;**then** remove this song from the playlist

**queries**
_getPlaylist(title: String): (playlist : Playlist)\
&emsp;**where** a playlist exists with this title\
&emsp;**then** return the playlist with this title

_getSongsAddedByUser(user: User, playlist: Playlist) : (songs: set of Song)\
&emsp;**then** return the set of songs in this playlist added by this user

Reaction Design
One of our essential mechanisms is adding a song by pasting the link. Thus, we have:

```
reaction RegisterPastedLink
	when Requesting.request (path: “/songs/register”, session, link)
	where Sessioning._getUser (session): (user)
	then SongRegistering.register (link)
Reaction ReportBadLink
	when 
Requesting.request (path: “/songs/register”, link)
		SongRegistering.register(link): (error)
	then Requesting.respond(request, error)
```

Additionally, when we add a new song, we want to be able to find that song on the other platform:

```
reaction TransposeNewSong
	when 
Requesting.request (path: “/songs/register”, link)
		SongRegistering.register (link): (song)
	where 
SongRegistering._getDetails(song): (platform, title, artist)
SongTransposing._getCorresponding (song): (songs) is empty
Then SongTransposing.transposeSong (song, platform, title, artist)
```

On adding a new song, we need to register this song in Transpose, so that we’ll only need to search up a given song once, and it’ll be reused in Transpose whenever other people want to add this song.

```
reaction RegisterCounterpart
 	when SongTransposing.transposeSong (song): (link)
 	then SongRegistering.register (link)

reaction RecordCorrespondence
 	when 
SongTransposing.transposeSong (song): (link)
SongRegistering.register (link): (counterpart)
then SongTransposing.addCorrespondence (song, counterpart)
```

Finally, Transpose will need to respond to the user, and let the user know that the song is now in Transpose. If we run the API search and, due to rate limitation or other reasons, we’re unable to find the song on the other platform, we can request the user manually paste in the song on the other platform.

```
reaction RespondWithSong
  when Requesting.request (path: "/songs/register", link)
       SongRegistering.register (link): (song)
  where SongTransposing._getCorresponding (song): (songs)
  then Requesting.respond (request, song, versions: songs)

reaction RespondNeedsManualLink
  when Requesting.request (path: "/songs/register", link)
       SongRegistering.register (link): (song)
       SongTransposing.transposeSong (song): (error)
  then Requesting.respond (request, song, versions: none, needsManualLink: true)
```

In particular, adding a link by hand would follow this reaction:

```
reaction RegisterManualLink
  when Requesting.request (path: "/songs/addVersion", session, song, link)
  where Sessioning._getUser (session): (user)
  then SongRegistering.register (link)

reaction RecordAlternateVersion
  when Requesting.request (path: "/songs/addVersion", song, link)
       SongRegistering.register (link): (version)
  then SongTransposing.addAlternateVersion (song, version)
```


Being able to add songs to Transpose is only half of the essential mechanisms of this app: the other important aspect of Transpose is the ability to create, share, edit, export, and play a playlist. 

Below, I’ve listed some examples of reactions required for creating and sharing a playlist (although it’s not an exhaustive list):

```
reaction CreatePlaylist
  when Requesting.request (path: "/playlists/create", session, title)
  where Sessioning._getUser (session): (user)
  then Playlisting.create (title)

reaction InviteFriend
  when Requesting.request (path: "/playlists/invite", session, playlist, username)
  where Sessioning._getUser (session): (user)
        Authenticating._getUserByUsername (username): (invitee)
  then PlaylistSharing.invite (playlist, inviter: user, invitee)

reaction AcceptInvite
  when Requesting.request (path: "/invites/accept", session, invite)
  where Sessioning._getUser (session): (user)
        user is invite's invitee
  then PlaylistSharing.accept (invite)

reaction SetMemberPermissions
  when Requesting.request (path: "/playlists/permissions", session, playlist, member, canAdd, canRemove)
  where Sessioning._getUser (session): (user)
  then PlaylistSharing.setPermissions (playlist, owner: user, member, canAdd, canRemove)
```

To add a song to a playlist, such a reaction would be needed:

```
reaction AddSongIfAllowed
  when Requesting.request (path: "/playlists/addSong", session, playlist, song)
  where Sessioning._getUser (session): (user)
        PlaylistSharing._canAdd (playlist, user): (allowed: true)
  then Playlisting.addSong (playlist, song)
```

And to play a playlist:

```
reaction PlayOnPreferredPlatform
  when Requesting.request (path: "/play", session, song)
  where Sessioning._getUser (session): (user)
        Preferring._getPreference (user): (platform)
        SongTransposing._getCorresponding (song): (versions)
        version is the first song in {song} ∪ versions whose
          SongRegistering._getDetails (version) platform is platform
        SongRegistering._getDetails (version): (link)
  then Requesting.respond (request, redirect: link)
```