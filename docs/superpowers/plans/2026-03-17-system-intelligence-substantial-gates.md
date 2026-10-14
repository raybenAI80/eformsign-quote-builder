# System Intelligence Substantial Task Gates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make global system intelligence behave more like an operating layer by auto-planning orchestration for substantial tasks and blocking completion when required execution evidence is missing.

**Architecture:** Extend the shared system-intelligence policy and helper layer with a stable substantial-task classifier, orchestration-plan helper, and completion gate checker. Reuse those helpers from bootstrap, open, and task workflows so start-time behavior and done-time enforcement stay consistent, then surface drift through health alerts and regression scripts.

**Tech Stack:** PowerShell 7, JSON policy/state files, existing `sysint-*` scripts

---

### Task 1: Shared Policy And Helpers

**Files:**
- Modify: `C:\Users\FORCS\.codex\tools\system-intelligence\shared.ps1`
- Test: `C:\Users\FORCS\.codex\tools\system-intelligence\tests\substantial-task-auto-plan.ps1`
- Test: `C:\Users\FORCS\.codex\tools\system-intelligence\tests\substantial-task-done-gate.ps1`

- [ ] Add default policy values for substantial-task orchestration and completion gates.
- [ ] Add helper functions to classify substantial tasks and explain why.
- [ ] Add helper functions to ensure orchestration lanes exist for a task.
- [ ] Add helper functions to validate completion gates for a task.
- [ ] Add health scoring support for missing orchestration plans and unbound active orchestration units.

### Task 2: Start-Time Auto Planning

**Files:**
- Modify: `C:\Users\FORCS\.codex\tools\system-intelligence\bootstrap.ps1`
- Modify: `C:\Users\FORCS\.codex\tools\system-intelligence\open.ps1`
- Modify: `C:\Users\FORCS\.codex\tools\system-intelligence\task.ps1`

- [ ] When bootstrap creates an in-progress task, auto-plan orchestration if the task is substantial.
- [ ] When open creates an in-progress task, auto-plan orchestration if the task is substantial.
- [ ] When task start marks a task in-progress, auto-plan orchestration if the task is substantial.

### Task 3: Completion Gates

**Files:**
- Modify: `C:\Users\FORCS\.codex\tools\system-intelligence\task.ps1`
- Modify: `C:\Users\FORCS\.codex\tools\system-intelligence\resume.ps1`

- [ ] Block `sysint-task done` for substantial tasks when required orchestration lanes are missing.
- [ ] Block `sysint-task done` for substantial tasks when fresh passing verification is missing.
- [ ] Surface meaningful resume/health output for these gaps.

### Task 4: Regression Coverage And Verification

**Files:**
- Create: `C:\Users\FORCS\.codex\tools\system-intelligence\tests\substantial-task-auto-plan.ps1`
- Create: `C:\Users\FORCS\.codex\tools\system-intelligence\tests\substantial-task-done-gate.ps1`

- [ ] Write the failing regression scripts first.
- [ ] Run them to watch them fail.
- [ ] Implement the minimal code to pass.
- [ ] Re-run regression scripts until they pass.
- [ ] Run workspace verification and record CI/health outcomes if needed.
