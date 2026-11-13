# Git push troubleshooting

## HTTP 400 during push

An HTTPS push of `feature/game-ui-polish` failed with:

```text
error: RPC failed; HTTP 400
fatal: The remote end hung up unexpectedly
Everything up-to-date
```

The final line did not mean the push succeeded: checking GitHub showed the branch was absent. Retrying with HTTP/1.1 and a 16 MiB upload buffer succeeded, and the remote commit hash was verified against local HEAD.

From the repository directory, save the working settings locally:

```bash
/usr/bin/git config --local http.version HTTP/1.1
/usr/bin/git config --local http.postBuffer 16777216
```

These commands affect only this local repository. They are not committed or shared automatically; apply them separately in another clone if needed.

For an existing branch with upstream tracking:

```bash
/usr/bin/git push
```

For the first push of a new branch:

```bash
/usr/bin/git push -u origin HEAD
```

To use the workaround for one push without saving settings:

```bash
/usr/bin/git -c http.version=HTTP/1.1 -c http.postBuffer=16777216 push -u origin HEAD
```

The buffer avoids chunked transfer for uploads below that size. Git documents this as a workaround for incompatible HTTP servers/proxies, not a general solution to every push failure. See [Git's HTTP configuration documentation](https://git-scm.com/docs/git-config.html#Documentation/git-config.txt-httppostBuffer).

## Git executable and version

At diagnosis on 2026-11-13, the shell selected `/usr/local/bin/git` (2.10.1), while `/usr/bin/git` provided Apple Git 2.30.1. Verify the current installation with:

```bash
type -a git
git --version
/usr/bin/git --version
```

Updating the default Git is worthwhile, but the newer installed client also failed until the transport workaround was applied. Version updates alone were not sufficient for this incident.

## Verify configuration and remote state

```bash
/usr/bin/git config --local --get http.version
/usr/bin/git config --local --get http.postBuffer
/usr/bin/git status --short --branch
/usr/bin/git rev-parse HEAD
/usr/bin/git ls-remote --heads origin refs/heads/feature/game-ui-polish
```

Replace the example branch in the final command with the branch being checked. A successful push should show the same commit hash remotely and locally.

To remove the repository-local overrides later:

```bash
/usr/bin/git config --local --unset http.version
/usr/bin/git config --local --unset http.postBuffer
```
