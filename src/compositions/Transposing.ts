import { no, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { Matching, SongRegistering } = concepts;

// The second stage of each reaction starts from Matching's answer, and its `song` can be any song
// registered earlier in the same request. Reading the song's details again keeps only the song
// that was searched for, so two songs registered together don't get each other's links.

// A song registered from Spotify gets a YouTube link, if YouTube has it.
const FindYoutubeLink = reaction(({ song, title, artist, match, url }) =>
  when(SongRegistering.register({}).responds({ song }))
    .where(
      SongRegistering._details({ song }).is({ platform: "SPOTIFY", title, artist }),
      no(SongRegistering._link({ song, platform: "YOUTUBE" })),
    )
    .then(Matching.find({ platform: "YOUTUBE", title, artist }).responds({ match }))
    .then(
      where(
        SongRegistering._details({ song }).is({ platform: "SPOTIFY", title, artist }),
        Matching._url({ match }).is({ url }),
      ).then(SongRegistering.addLink({ song, link: url })),
    ),
);

// A song registered from YouTube gets a Spotify link, if Spotify has it.
const FindSpotifyLink = reaction(({ song, title, artist, match, url }) =>
  when(SongRegistering.register({}).responds({ song }))
    .where(
      SongRegistering._details({ song }).is({ platform: "YOUTUBE", title, artist }),
      no(SongRegistering._link({ song, platform: "SPOTIFY" })),
    )
    .then(Matching.find({ platform: "SPOTIFY", title, artist }).responds({ match }))
    .then(
      where(
        SongRegistering._details({ song }).is({ platform: "YOUTUBE", title, artist }),
        Matching._url({ match }).is({ url }),
      ).then(SongRegistering.addLink({ song, link: url })),
    ),
);

export const composition = { FindYoutubeLink, FindSpotifyLink };
