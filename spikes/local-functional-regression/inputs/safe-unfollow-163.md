# Safe Unfollow functional issue #163

## Source

Public issue:
https://github.com/ignromanov/safe-unfollow/issues/163

Capture date:
2026-09-01

## Expected behavior

If the browser page is refreshed or closed while local ZIP analysis is in
progress, returning to the upload page must not leave the application
permanently busy.

The user must be able to use the upload page again without manually editing
browser storage.

## Observed behavior

After a refresh during local analysis, the upload page can remain indefinitely
on:

“Analyzing locally…”

The file input remains disabled and the page offers no effective way to leave
the stuck processing state.

## Reproduction outline

1. Open the local application upload page.
2. Establish the browser state representing an interrupted local analysis.
3. Reload the page.
4. Observe the rehydrated upload interface.
5. Determine whether the page returns to an operable idle state.

## Preconditions

- local application only;
- no user account;
- no external API;
- no real Instagram data;
- browser-persisted state is allowed as a deterministic test precondition;
- application is opened at `/upload`.

## Unknowns to discover from the pre-fix application

- the exact browser storage key and schema;
- the most stable observable processing indicator;
- the accessible identity of the file input;
- whether any redirect or hydration delay affects the assertion;
- which state checks are sufficiently semantic and not tied to incidental CSS.
