# PlaylistSharing

## Purpose

Let playlist owners invite collaborators and control who can view, add, and remove songs.

## Principle

The owner invites a friend. When the friend accepts, they can see the playlist and add songs. The owner can grant removal permission, revoke editing permissions, or remove the member. Members can leave at any time.

## Types

```types
external Playlist
    The playlist being shared.
external User
    The owner, member, or invitee.
```

## State

```state
a set of Shares with
  a unique playlist Playlist
  an owner User
  a memberships set of Memberships
  an invites set of Invites
a set of Memberships with
  a member User
  a canAdd Flag
  a canRemove Flag
a set of Invites with
  an inviter User
  an invitee User
```

## Actions

```actions
startSharing (playlist: Playlist, owner: User) : returns (playlist: Playlist)
  where no share exists or this user already owns it
  then
    ensure there is a share
    returns playlist
  where a different user owns the share
  then
    refuses SHARING_DENIED "This playlist already has an owner."

invite (playlist: Playlist, inviter: User, invitee: User) : returns (invite: Invite)
  where inviter owns the share and invitee is neither the owner, a member, nor already invited
  then
    create an invitation for invitee
    returns invite
  where the conditions above do not hold
  then
    refuses SHARING_DENIED "The invitation is not allowed."

accept (invite: Invite, user: User) : returns (invite: Invite)
  where user is the pending invitee
  then
    create a membership with canAdd true and canRemove false, remove the invitation
    returns invite
  where the conditions above do not hold
  then
    refuses SHARING_DENIED "The invitation is unavailable."

decline (invite: Invite, user: User) : returns (invite: Invite)
  where user is the pending invitee
  then
    remove the invitation
    returns invite
  where the conditions above do not hold
  then
    refuses SHARING_DENIED "The invitation is unavailable."

setPermissions (playlist: Playlist, owner: User, member: User, canAdd: Flag, canRemove: Flag) : returns (playlist: Playlist)
  where owner owns the share and member belongs to it
  then
    change the member's permissions
    returns playlist
  where the conditions above do not hold
  then
    refuses SHARING_DENIED "The permission change is not allowed."

removeMember (playlist: Playlist, owner: User, member: User) : returns (playlist: Playlist)
  where owner owns the share and member belongs to it
  then
    remove the membership
    returns playlist
  where the conditions above do not hold
  then
    refuses SHARING_DENIED "The removal is not allowed."

leave (playlist: Playlist, member: User) : returns (playlist: Playlist)
  where member belongs to the share
  then
    remove the membership
    returns playlist
  where the conditions above do not hold
  then
    refuses SHARING_DENIED "The membership is unavailable."

stopSharing (playlist: Playlist, owner: User) : returns (playlist: Playlist)
  where owner owns the share
  then
    remove the share and all memberships and invitations
    returns playlist
  where the conditions above do not hold
  then
    refuses SHARING_DENIED "The share is unavailable."
```

## Queries

```queries
_canView (playlist: Playlist, user: User) : one (allowed: Flag)
    True for the owner and active members.
_canAdd (playlist: Playlist, user: User) : one (allowed: Flag)
    True for the owner and members with add permission.
_canRemove (playlist: Playlist, user: User) : one (allowed: Flag)
    True for the owner and members with remove permission.
_getMembers (playlist: Playlist) : many (owner: User, member: User, canAdd: Flag, canRemove: Flag)
    One row per member with the share's owner and the member's permissions.
_getInvites (invitee: User) : many (invite: Invite, playlist: Playlist, inviter: User, invitee: User)
    Pending invitations for the user.
_getSharedPlaylists (user: User) : many (playlist: Playlist)
    Playlists the user owns or belongs to.
```
