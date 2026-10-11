# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Staff password hashing now runs on bcryptjs through the BetterAuth configuration, and staff creation, temp reissue, and seeding write through the BetterAuth API instead of direct database calls (see spec 0006).
- Guest stay PINs now hash with bcryptjs instead of hand rolled scrypt; existing scrypt rows keep verifying and upgrade to bcrypt on first successful match (see spec 0005).
- Over budget sign in and stay mint answers now carry retry seconds plus a Retry After header so screens can show a wait message (see spec 0007).

### Added

- Test coverage for the staff password flow: hasher config, request schemas, and account service behaviours (see spec 0006).
- Staff sign in with email plus password across front desk, kitchen, and admin roles, with per role screens, temporary passwords on first sign in, and sign in cooldown after repeated misses (see spec 0004).
- Guest stay sessions: one PIN entry mints a stay bound session covering the whole stay, revoked at checkout or PIN lock (see spec 0004).
- Staff admin screens to create accounts with roles, reissue temporary passwords, and unlock PIN locked stays (see spec 0004).
- Test coverage for staff gates, request schemas, rate limiting, and the full sign in plus mint prove walk (see spec 0004).
- Live order channel: one room per stay plus one kitchen room with cookie verified joins, server emitted order events, and a browser helper that rejoins plus refetches after a drop (see spec 0007).
- Shared rate limit budgets for order creation alongside the existing sign in and stay mint budgets, with one 429 shape everywhere (see spec 0007).
- Test coverage for the realtime contract, emit helper, browser join helper, limiter budgets, route 429 shapes, and the live realtime prove walk (see spec 0007).

### Removed

- Demo socket chat handlers, replaced by the stay plus kitchen room foundation (see spec 0007).

### Fixed

- Browser live client now joins its room on first load instead of staying roomless until a reconnect (see spec 0007).
