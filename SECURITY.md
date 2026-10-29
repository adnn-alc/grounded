# Security Policy

## Supported versions

Only the latest release of Grounded gets security fixes. Please update before reporting.

## Reporting a vulnerability

**Please don't open a public issue for security problems.**

Report it privately through GitHub instead: go to the repository's **Security** tab → **Report a vulnerability** ([direct link](https://github.com/adnn-alc/grounded/security/advisories/new)).

Please include:

- what the problem is and what an attacker could do with it
- steps to reproduce (a request, a payload, or a short script)
- the Grounded version (shown in the sidebar and under Settings → About) and how you run it (Docker, Node version)

This is a hobby project maintained by one person, so there is no formal SLA. You can expect an acknowledgement within about a week, and a fix or a plan shortly after for anything confirmed. You'll be credited in the release notes unless you'd rather not be.

## Scope and design notes

Grounded has **no login or authentication by design** — it's meant for a trusted home network, and anyone who can reach the port can read and change all data. The README's [Security section](README.md#security) explains how to put it behind a reverse proxy with authentication if you expose it.

So "there is no login" is not a vulnerability by itself. Things that **are** in scope, for example:

- reading or changing data from a *different* website the user visits (CSRF, DNS rebinding)
- reading files outside the app, or running code on the server
- cross-site scripting through data entered in the app
- anything that corrupts or deletes data unexpectedly
- vulnerable dependencies that are actually reachable in Grounded
