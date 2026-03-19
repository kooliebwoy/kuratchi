---
'@kuratchi/js': minor
---

Refactor the framework compiler around dedicated pipelines, move request execution into a stable shared runtime, and add first-class `$server`, `$shared`, and `$client` import realms for top-level route and layout scripts.

This release also hardens route generation by separating imported bindings from load return data, introducing explicit head/fragment render contracts, adding root layout client-handler support, and expanding compiler/runtime regression coverage around route actions, shared helpers, router behavior, and generated worker rendering.
