# Transposing

Registering a song only records the platform it came from. Finding the same song on the other platform is the application's decision, so it lives here rather than inside SongRegistering.

When a song is registered from a Spotify link and has no YouTube link yet, Transpose [looks it up on YouTube](reaction:Transposing.FindYoutubeLink) by the title and artist Spotify reported, and adds the video Matching finds as one of the song's links. When a song is registered from a YouTube link and has no Spotify link yet, Transpose [looks it up on Spotify](reaction:Transposing.FindSpotifyLink) the same way.

Both reactions check that the other platform's link is missing first. Registering a link that is already known, or a Spotify release whose ISRC joins an existing song, therefore costs no search. When Matching finds nothing, or its search fails, the song keeps only its own link, and a user can still add one by hand with SongRegistering's addLink.
