# Examples

This directory may contain small runnable examples only after a current acceptance need exists.
It does not reserve product surfaces.

An admitted example must:

- use synthetic local data or a user-supplied disposable local target;
- bind services to loopback and require no external account;
- document start, readiness, reset, cleanup, and the independent outcome contract;
- contain ordinary executable tests and inspectable expected outputs;
- distinguish fixture-specific evidence from general product evidence; and
- remain small enough to review and remove.

The first likely example is a deterministic local Bug/Fix fixture used for engineering tests. A
real user case remains in the user's supplied repository or an explicitly authorized case area; it
is never redesigned merely to make ReproLock appear successful.
