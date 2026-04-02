---
name: adk-cli
description: Use when using adk (Agent Development Kit) CLI to manage skills or agents - searching, downloading, uploading skills, validating, or checking authentication status
---

# adk CLI

Agent Development Kit CLI for managing Agent Skills and Agents. Uses `adk skill <action>` or `adk agent <action>` structure.

## Quick Reference

### Skill Commands

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

### Agent Commands

| Command | Syntax | Purpose |
|---------|--------|---------|
| Search | `adk agent search <keyword>` | Find agents by keyword |
| List | `adk agent ls` | List all public agents |
| Info | `adk agent info <name>` | Show agent details |
| Download | `adk agent download <name> [dir]` | Download agent (default: current dir) |

### Auth & Server Commands

| Command | Syntax | Purpose |
|---------|--------|---------|
| Login | `adk login <server-url> <api-key>` | Authenticate to server |
| Logout | `adk logout` | Log out current user |
| Whoami | `adk me` | Show current user info |
| Server | `adk server set <url>` | Set default server |

## Common Mistakes

| Wrong | Correct | Why |
|-------|---------|-----|
| `adk search pdf` | `adk skill search pdf` | Missing `skill` subcommand |
| `adk agent list` | `adk agent ls` | Wrong verb: `ls` not `list` |
| `adk agent search pdf` | `adk agent search pdf` | ✅ Correct |
| `adk publish ./skill` | `adk skill upload ./skill` | Wrong verb: `upload` not `publish` |
| `adk skill show name` | `adk skill info name` | Wrong verb: `info` not `show` |
| `adk download name --output ./dir` | `adk skill download name ./dir` | Positional arg, not flag |
| `adk agent download name --dest ./dir` | `adk agent download name ./dir` | Positional arg, not flag |
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
