## Project Workflow Automation

This repository uses GitHub Actions + GitHub Projects (v2) to automate the full development lifecycle. Every issue, branch, PR, and review action is tracked automatically on the project board.

### Workflow Diagram

```
Issue ──→ Branch ──→ PR ──→ Review ──→ Merge PR ──→ Close Issue
 │          │        │        │            │             │
 │          │        │   (or Direct       │             │
 │          │        │    Bypass)         │             │
 ▼          ▼        ▼                    ▼             ▼
[Todo] → [In Progress] → [In Review] ──────────→ [Done]
                │               │                   ▲
                │               │    PR Closed ─────┘
                │               │    (not merged)
                ▼               ▼
         Branch deleted    Issue closed
         (no PR opened)    mid-workflow
              │                 │
              ▼                 ▼
           [Todo]            [Done]
```

### Project Board States

| Status        | Triggered By                                      |
|---------------|---------------------------------------------------|
| **Todo**      | Issue opened / Branch deleted without a PR         |
| **In Progress** | Branch created with issue number in name        |
| **In Review** | Non-draft PR opened / Draft PR marked ready / PR edited to link issue |
| **Done**      | PR merged / PR closed / Issue closed (any state)  |
| *(removed)*   | Issue deleted / Issue transferred out              |

### Laws (Enforced Automatically)

1. **Don't fail using review, just comment** — "Request Changes" reviews are advisory only and will not block PR merges. A reminder comment is posted automatically.
2. **Don't open multiple PRs for the same issue** — If a duplicate PR is detected, it is automatically closed with an explanation.
3. **If a PR is closed, create a new issue — don't reopen** — Closed PRs cannot be reopened. A comment is posted explaining to create a new issue + PR.
4. **We don't reopen issues** — Reopened issues are automatically closed again with a comment directing users to create a new issue.
5. **Assign the PR and issue to the PR opener automatically** — When a PR is opened, both the PR and its linked issue are assigned to the PR author.

### Edge Cases Handled

#### Closing an Issue Mid-Workflow
If an issue is closed while its project card is in **In Progress** or **In Review** (not just Todo), the card moves to **Done** automatically. The `issue-closed` event handler moves the card to Done from *any* state, preventing cards from getting stuck.

#### Branch Deletion Without a PR
If a branch is deleted without a PR ever being opened, the linked issue's card moves back from **In Progress** to **Todo** instead of getting stuck. The workflow checks whether any PR (open, closed, or merged) was ever associated with the branch before deciding.

#### Draft PRs
Draft PRs do **not** move the issue to "In Review". The card stays in "In Progress" until the PR is marked as ready for review (`ready_for_review` event), at which point it moves to "In Review".

#### PR Description Edited After Opening
If `Closes #X` is added to the PR body after the initial open, the `edited` event re-extracts linked issues and moves them to "In Review". This prevents cards from getting stuck when the issue link is added late.

#### Issue Transferred to Another Repository
When an issue is transferred out, it is automatically removed from this project board. The receiving repository's automation (if configured) will pick it up.

#### Concurrency Controls
Each workflow uses concurrency groups (per issue number, PR number, or branch name) to prevent overlapping runs from racing against each other (e.g., PR merge triggering both `pr-merged` and `issue-closed` simultaneously).

#### PR Converted Back to Draft
If a non-draft PR is converted to a draft, the linked issue card moves back from **In Review** to **In Progress**. It returns to "In Review" when the PR is marked ready again.

#### PR Opened Referencing a Closed Issue
All PR handlers (`opened`, `ready_for_review`, `edited`) check if the linked issue is still **open** before moving it to "In Review". This prevents accidentally pulling a "Done" card back to "In Review".

#### Multiple Branches for Same Issue
When a branch is deleted, the workflow checks if any *other* branch still references the same issue number before moving it back to "Todo". If another branch exists, the card stays in "In Progress".

#### Bot-Triggered Close Loops
When the prevent-reopen bot re-closes a PR, the `pr-closed-unmerged` handler detects the closer is `github-actions[bot]` and skips posting a duplicate "create a new issue" comment.

### Setup Instructions

#### 1. Create a GitHub Project (v2)

1. Go to your repository → **Projects** → **New project**
2. Add a **Status** field (single select) with exactly these options:
   - `Todo`
   - `In Progress`
   - `In Review`
   - `Done`

> The status option names must match exactly (case-sensitive).

#### 2. Create a Personal Access Token (PAT)

1. Go to **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Create a token with these permissions:
   - **Repository permissions:**
     - Issues: Read & Write
     - Pull requests: Read & Write
     - Contents: Read
   - **Organization/Account permissions:**
     - Projects: Read & Write
3. Copy the token

#### 3. Configure Repository Secrets & Variables

**Secrets** (Settings → Secrets and variables → Actions → Secrets):

| Secret          | Value                                  |
|-----------------|----------------------------------------|
| `PROJECT_TOKEN` | The PAT created in step 2              |

**Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable          | Value                                                |
|-------------------|------------------------------------------------------|
| `PROJECT_NUMBER`  | The project number (from the project URL)            |
| `PROJECT_OWNER`   | Owner of the project (your GitHub username or org name) |

#### 4. Branch Protection (Recommended)

To align with the "Don't fail using review" law:
- Do **NOT** enable "Require approving reviews" in branch protection rules
- Reviews are advisory — merging should not be blocked by review status

#### 5. Branch Naming Convention

Branches must include the issue number for automatic linking:

```
42-add-login-page       ✓
issue-42                ✓
issue/42                ✓
feature/42-add-login    ✓
fix/42-bug              ✓
my-feature-branch       ✗ (no issue number — won't update project)
```

#### 6. PR Description

Use closing keywords in your PR description to link issues:

```
Closes #42
Fixes #42
Resolves #42
```

A PR template is provided at `.github/PULL_REQUEST_TEMPLATE.md`.

### Files

```
.github/
├── PULL_REQUEST_TEMPLATE.md        # PR template with issue linking prompt
├── scripts/
│   └── project-helpers.sh          # Shared helper functions for GraphQL API
└── workflows/
    ├── issue-automation.yml        # Issue lifecycle (opened/closed/deleted/reopened)
    ├── branch-automation.yml       # Branch lifecycle (created/deleted)
    └── pr-automation.yml           # PR lifecycle (opened/closed/merged/reopened/review)
```