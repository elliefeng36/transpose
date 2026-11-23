# Transpose application types

```types
concrete User
  The identity of a user of the application.
```

```instances
instantiate SongRegistering

instantiate Playlisting with
  User is User
  Song is SongRegistering.Song
```
