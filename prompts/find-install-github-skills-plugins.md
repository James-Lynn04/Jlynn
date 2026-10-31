# Prompt: Find and Install the Best GitHub Skills and Plugins

Copy everything below the line into Claude Code. Edit the three inputs at the top first.

---

You are my Claude Code setup assistant. Find the best Claude Code skills and plugins on GitHub for my work, then install the winners in this repo.

## Inputs

- My role and daily work: [e.g. commercial real estate lending, deal underwriting, Excel models, email, CRM in Pipedrive]
- Tasks I want to speed up: [e.g. review PDFs, build term sheets, clean spreadsheets, write follow-up emails]
- Install scope: [project = .claude/settings.json in this repo, or user = ~/.claude/settings.json]

## Step 1. Audit what I already have

1. Read `.claude/settings.json` and `~/.claude/settings.json` if present.
2. List every entry in `extraKnownMarketplaces` and `enabledPlugins`.
3. List skills in `.claude/skills/` and `~/.claude/skills/`.
4. Report a table: name, source repo, what it does. Do not install duplicates.

## Step 2. Search GitHub

Search these sources first, in this order:

1. `anthropics/claude-plugins-official` (official plugin marketplace)
2. `anthropics/skills` (official skills: docx, xlsx, pptx, pdf, skill-creator and more)
3. `anthropics/claude-code` (bundled example plugins)
4. Community lists: search GitHub for `awesome-claude-code`, `awesome-claude-skills`, `claude-code-plugins`

Then run GitHub searches with these queries:

- `filename:marketplace.json path:.claude-plugin`
- `filename:SKILL.md` plus keywords from my tasks
- `topic:claude-code-plugin`, `topic:claude-skills`, `topic:claude-code`

Collect at least 15 candidates before you filter.

## Step 3. Score each candidate

Score 1 to 5 on each line. Drop anything under 18 of 30.

| Criterion | What to check |
|---|---|
| Fit | Matches one of my listed tasks |
| Trust | Official Anthropic repo, known org, or author with a public track record |
| Activity | Commit in the last 90 days, open issues get replies |
| Adoption | Stars, forks, mentions in awesome lists |
| Quality | Clear SKILL.md or plugin.json, README with install steps, examples |
| Safety | No obfuscated code, no curl-pipe-to-shell, no hidden network calls, hooks do what the README says |

## Step 4. Security review before install

For each finalist, read every file in the plugin or skill folder. Flag:

- Hooks in `hooks/hooks.json` or `settings.json` that run shell commands
- MCP servers that send data to third-party hosts
- Scripts that read `~/.ssh`, `.env`, credentials, or browser data
- Requests for broad `permissions.allow` rules such as `Bash(*)`

List each flag with file path and line number. Exclude any candidate with an unexplained flag.

## Step 5. Show me the shortlist

Present the top 5 to 8 in one table: name, repo, type (skill or plugin), score, one line on what it does for me, any flags. Wait for my approval before you install anything.

## Step 6. Install the approved items

Plugins:

1. Add the marketplace: `/plugin marketplace add <owner>/<repo>`
2. Install: `/plugin install <plugin-name>@<marketplace-name>`
3. For a committed project setup, write the same result to `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "<marketplace-name>": {
      "source": { "source": "github", "repo": "<owner>/<repo>" }
    }
  },
  "enabledPlugins": {
    "<plugin-name>@<marketplace-name>": true
  }
}
```

Merge with existing keys. Never delete current entries.

Skills:

1. Copy the skill folder into `.claude/skills/<skill-name>/` so `SKILL.md` sits at the folder root.
2. Keep the source repo URL and commit SHA in a comment at the top of `SKILL.md` or in `.claude/skills/SOURCES.md`.

## Step 7. Verify

1. Validate `.claude/settings.json` as JSON.
2. Run `/plugin` and confirm each plugin shows as enabled.
3. Confirm each new skill appears in the available skills list.
4. Run one real task per item to prove it works. Report pass or fail with the output.

## Step 8. Commit

Commit on the current branch with a message listing each item added and its source repo. Push only after I confirm.

## Output format

- Plain sentences. Short. No filler.
- Tables for audits and shortlists.
- Every claim about a repo links to the repo.
