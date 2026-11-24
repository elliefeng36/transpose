# Sessioning

## Purpose

Grant a short-lived session to a verified subject.

## Principle

A subject can use an issued session to act as themselves until it expires or is ended.

## Types

```types
external User
  The subject of a session.
```

## State

```state
a set of Sessions with
  a subject User
  an expiresAt DateTime
```

## Actions

```actions
start (subject: User) : returns (session: Session)
  where a subject requests a session
  then
    create a random session valid for thirty minutes
    returns session

end (session: Session) : returns (ended: Flag)
  where a session identifier is supplied
  then
    discard the session if present
    returns ended
```

## Queries

```queries
_active (session: Session) : optional (subject: User)
  The subject of an active session.
```
