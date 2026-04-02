---
name: adk-cli
description: Use when using adk (Agent Development Kit) CLI to manage skills - searching, downloading, uploading, validating skills, or checking authentication status
---

# adk CLI

Agent Development Kit CLI for managing Agent Skills. All skill commands use `adk skill <action>` structure.

## Quick Reference

| Command | Syntax | Purpose |
|---------|--------|---------|
| Search | `adk skill search <keyword>` | Find skills by keyword |
| List | `adk skill ls` | List all public skills |
| Info | `adk skill info <name>` | Show skill details |
| Download | `adk skill download <name> [dir]` | Download skill (default: current dir) |
| Upload | `adk skill upload <path>` | Upload local skill directory |
| Validate | `adk skill validate <path>` | Verify skill format (dir or ZIP) |
| My skills | `adk skill my` | List skills I published |
| Delete | `adk skill delete <name>` | Delete my published skill |
| Login | `adk login <server-url> <api-key>` | Authenticate to server |
| Logout | `adk logout` | Log out current user |
| Whoami | `adk me` | Show current user info |
| Server | `adk server set <url>` | Set default server |

## Common Mistakes

| Wrong | Correct | Why |
|-------|---------|-----|
| `adk search pdf` | `adk skill search pdf` | Missing `skill` subcommand |
| `adk publish ./skill` | `adk skill upload ./skill` | Wrong verb: `upload` not `publish` |
| `adk skill show name` | `adk skill info name` | Wrong verb: `info` not `show` |
| `adk download name --output ./dir` | `adk skill download name ./dir` | Positional arg, not flag |
| `adk auth whoami` | `adk me` | Direct command, not nested |

## Workflow: Upload Skill

Always validate before uploading:

```bash
adk skill validate ./my-skill
adk skill upload ./my-skill
```

## Configuration

Config stored in `~/.adk/config.json`:
- `serverUrl`: Active server endpoint
- `token`: JWT auth token
- `user`: Current user info
