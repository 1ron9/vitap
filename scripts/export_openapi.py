"""Export the IMPLEMENTED API only; --check detects contract drift in CI."""
import argparse
import json
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'backend'))
from app.main import app

parser=argparse.ArgumentParser()
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
path=root/'contracts/openapi.json'
content=json.dumps(app.openapi(),ensure_ascii=False,indent=2,sort_keys=True)+'\n'
if args.check:
    if not path.exists() or path.read_text(encoding='utf-8')!=content:
        raise SystemExit('OpenAPI changed: run python scripts/export_openapi.py and review the diff')
else:
    path.parent.mkdir(exist_ok=True)
    path.write_text(content,encoding='utf-8')
