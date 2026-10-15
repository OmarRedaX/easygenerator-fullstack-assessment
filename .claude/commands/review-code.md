---
description: Review the branch with parallel dimension reviewers, then adversarially verify each finding.
argument-hint: [scope]
---
Dispatch reviewers in ONE message: (1) correctness, (2) security vs backend/CLAUDE.md Security rules, (3) contract drift vs
contracts/openapi.yaml. Each reports findings with file:line. Then try to REFUTE each finding; keep only the ones that survive.
Write one review file; fix survivors via /develop.
