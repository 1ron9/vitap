"""PostgreSQL durable worker scaffold. python -m app.workers.runner --once.

Only storage deletion is enabled. OCR must register its real handler before an
upload endpoint accepts work. Unknown kinds fail visibly, never fake success.
"""
import argparse
import time
from sqlalchemy import text
from app.core.database import engine
from app.core.config import settings
from app.integrations.storage import LocalPrivateStorage

def run_once():
    with engine.begin() as db:
        # Recover leases after a process restart (at-least-once delivery).
        db.execute(text("""UPDATE background_jobs SET status = CASE WHEN attempts >= max_attempts THEN 'FAILED' ELSE 'PENDING' END,
          error_code='LEASE_EXPIRED', locked_at=NULL
          WHERE status='PROCESSING' AND locked_at < now() - interval '5 minutes'"""))
        job = db.execute(text("""UPDATE background_jobs SET status='PROCESSING', locked_at=now(), attempts=attempts+1
          WHERE id=(SELECT id FROM background_jobs WHERE status='PENDING' AND available_at<=now()
            ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
          RETURNING id,kind,payload,attempts,max_attempts""")).mappings().first()
    if job is None:
        return False
    try:
        if job['kind'] != 'DELETE_FILE':
            raise ValueError('UNSUPPORTED_JOB_KIND')
        LocalPrivateStorage(settings.STORAGE_ROOT).delete(job['payload']['storage_key'])
    except Exception:
        with engine.begin() as db:
            db.execute(text("""UPDATE background_jobs SET status=CASE WHEN attempts>=max_attempts THEN 'FAILED' ELSE 'PENDING' END,
              available_at=now()+interval '30 seconds', locked_at=NULL,error_code='JOB_FAILED' WHERE id=:id AND attempts=:attempt"""), {'id':job['id'],'attempt':job['attempts']})
    else:
        with engine.begin() as db:
            db.execute(text("UPDATE background_jobs SET status='COMPLETED',completed_at=now(),locked_at=NULL WHERE id=:id AND attempts=:attempt"), {'id':job['id'],'attempt':job['attempts']})
    return True

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--once',action='store_true')
    args=parser.parse_args()
    while True:
        found=run_once()
        if args.once:
            break
        if not found:
            time.sleep(2)
