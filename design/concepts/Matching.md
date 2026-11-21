# Matching

## Purpose

Find a song's counterpart on another platform from its title and artist, remember the answer so the same search is never paid for twice, and let people correct an answer that's wrong.

## Principle

Someone asks for "Mr. Brightside" by The Killers on YouTube. The platform is searched, and the match keeps the videos it found, best first, with the best one as its link. Asking again for the same title and artist on YouTube returns the same match without searching. If someone says that video is the wrong one, the match moves on to the next video the search found, without searching again, and never gives the rejected video for that title and artist again; once every video it found has been rejected, the match has no link. When the platform has nothing that fits, the match is still kept, with no link, so later asks also skip the search. When the search fails once, for example because the network dropped, the match has no link and the next ask searches again. When the platform says its quota is used up, Matching stops calling that platform until the time the platform gives for the reset; every ask until then gets a match with no link and costs nothing, and the first ask after the reset searches again.

## Types

```types
Platform is SPOTIFY or YOUTUBE
  Which streaming service to search.
```

## State

```state
a set of Matches with
  a platform Platform
  a title String
  an artist String
  a candidates seq of String
  a rejected set of String
  an optional songId String
a set of Unsettled Matches
a set of Pauses with
  a unique platform Platform
  an until DateTime
Rule: candidates are the ids of the songs the platform search found, best first; rejected are the ones someone said are the wrong song.
Rule: songId is the first candidate that isn't rejected. A match has none when its search found nothing or failed, or when every candidate was rejected.
Rule: a match is unsettled only when its search failed, so the next find for the same platform, title, and artist searches again.
```

## Actions

```actions
find (platform: Platform, title: String, artist: String) : returns (match: Match)
  where a match that is not in Unsettled Matches has this platform, title, and artist
  then
    returns match
  where a pause for platform has an until that's later than now
  then
    add a new match with no candidates to Unsettled Matches
    returns match
  where the platform search finds songs
  then
    add a new match whose candidates are the songs' ids, best first, and whose songId is the first of them
    returns match
  where the platform search finds nothing
  then
    add a new match with no candidates
    returns match
  where the platform search reports its quota is used up until a time
  then
    set the pause for platform to that time
    add a new match with no candidates to Unsettled Matches
    returns match
  where the platform search fails for any other reason
  then
    add a new match with no candidates to Unsettled Matches
    returns match

reject (match: Match, songId: String) : returns (match: Match)
  where match is in Matches
  then
    add songId to the match's rejected
    set the match's songId to its first candidate that isn't rejected, or to none when every candidate is rejected
    returns match
  where match is not in Matches
  then
    returns match
```

## Queries

```queries
_url (match: Match) : optional (url: String)
  The song's link on the match's platform; no row when the match found nothing or is unknown.
```
