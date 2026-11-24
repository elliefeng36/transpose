# Authenticating

## Purpose

Register accounts and verify their passwords.

## Principle

A person claims a unique username and can later prove ownership using the password they registered with.

## Types

```types
```

## State

```state
a set of Accounts with
  a unique username String
  a verifier String
```

## Actions

```actions
register (username: String, password: String) : returns (account: Account)
  where the credentials fail the format rules
  then
    refuses INVALID_CREDENTIALS "Invalid username or password format."
  where the username is already registered
  then
    refuses USERNAME_TAKEN "That username is already registered."
  where the credentials are valid and the username is available
  then
    store an Argon2id verifier
    returns account

authenticate (username: String, password: String) : returns (account: Account)
  where the username exists and its verifier matches the password
  then
    returns account
  where the account does not exist or the password does not match
  then
    refuses INVALID_CREDENTIALS "Incorrect username or password."
```

## Queries

```queries
_registered (username: String) : one (registered: Flag)
  Whether the username has an account.
```
