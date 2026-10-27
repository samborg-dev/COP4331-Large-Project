# CI and merge rules

Every pull request into `main` runs [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
on GitHub Actions. You can see it at the bottom of the PR and in the Actions tab.

| Job | Runs | Required to merge? |
|---|---|---|
| **Web + API** | `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `build`, `test` | Yes |
| **Mobile (Flutter)** | `flutter pub get`, `flutter analyze`, `flutter test` (once `apps/mobile/test/` exists) | Not yet. Turn it on once it's green |

**Run the same thing before you push**, so CI isn't where you find out:

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

If CI fails, click **Details** next to the failed check to see which step broke.
Push a fix to the same branch and CI re-runs by itself.

- `--frozen-lockfile` fails when `package.json` changed but `pnpm-lock.yaml`
  wasn't committed. Run `pnpm install` and commit the lockfile.
- Adding tests: give a package a `"test"` script (for example `"test": "vitest run"`)
  and CI picks it up automatically.

## One-time GitHub setup (Sam)

This is what actually blocks merging. The workflow only reports pass or fail.

1. Push a branch with the workflow and open a PR, so the check runs once. GitHub
   only offers checks it has seen.
2. Go to **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
3. Set the name to `protect main` and **Enforcement status** to **Active**.
4. Under **Target branches**, choose **Add target → Include default branch**.
5. Turn on these rules:
   - **Restrict deletions**
   - **Block force pushes**
   - **Require a pull request before merging**, with **Required approvals: 1**.
     Also tick **Dismiss stale approvals when new commits are pushed**.
   - **Require status checks to pass**:
     - Tick **Require branches to be up to date before merging**.
     - Click **Add checks** and pick **Web + API**.
6. Leave the bypass list empty, so the rules apply to everyone, including admins.
   Then click **Create**.

When the Flutter job is passing, edit the ruleset and add **Mobile (Flutter)** as a
second required check.
