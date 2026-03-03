---
trigger: always_on
---

For changes successfully implemented and validated, remeber to push to git: git add . ; git commit -m "..." ; git push


# Agent Instructions

> [!IMPORTANT]
> **Git Configuration for Deployments**
>
> To ensure successful deployments (Vercel/GitHub integration), all commits **MUST** be authored by `fabiank5@hotmail.com`.
>
> Before pushing any changes, always verify or set the git configuration:
> ```bash
> git config user.email "fabiank5@hotmail.com"
> git config user.name "Fabian Senk"
> ```
> Failure to do this will result in the deployment being ignored.


> [!IMPORTANT]
> **Artifact Integrity**
>
> When updating artifacts (`task.md`, `implementation_plan.md`, `walkthrough.md`):
> 1.  If a `replace` tool fails, **IMMEDIATELY** read the file to understand the current state.
> 2.  If edits are complex or repeated failures occur, use `write_to_file` with `Overwrite: true` to replace the **ENTIRE** file with the correct content.
> 3.  **ALWAYS** verify the artifact content matches expectations before notifying the user. Do not assume an edit succeeded if there were errors.

> [!IMPORTANT]
> **Deployment Workflow**
>
> When testing changes on the live Vercel deployment:
> 1.  Changes **MUST** be committed and pushed immediately.
> 2.  Do NOT wait for user approval to push if the goal is to trigger a deployment for verification.
> 3.  Always reference the deployment trigger in your response to the user.
