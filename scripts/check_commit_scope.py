"""Review aid: list changed files; cross-module changes require reviewers, not bans."""
import argparse
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--staged', action='store_true')
parser.add_argument('--module', default='integration', help='Task module, informational only')
args = parser.parse_args()
cmd = ['git', 'diff', '--cached', '--name-only'] if args.staged else ['git', 'diff', '--name-only', 'origin/dev...HEAD']
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode:
    raise SystemExit('Fetch origin/dev first, or use --staged before the first dev push.')
print('Review scope (' + args.module + '):')
print(result.stdout)
print('Cross-module changes are allowed with the appropriate reviewers. Base feature PRs on dev.')
