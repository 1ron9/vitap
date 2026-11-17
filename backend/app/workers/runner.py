"""Durable worker. Run with ``python -m app.workers.runner``."""
import argparse
import logging
import time
from uuid import UUID
from sqlalchemy import select, text
from app.core.database import engine, SessionLocal
from app.core.config import settings
from app.integrations.storage import LocalPrivateStorage
from app.modules.medication.models import OcrJobs, Prescriptions
from app.workers.models import BackgroundJob
from app.modules.medication.service import MedicationOcrService

logger = logging.getLogger(__name__)


def _process_ocr(payload):
    db = SessionLocal()
    try:
        MedicationOcrService().process_ocr_job(UUID(payload["ocr_job_id"]), db)
    finally:
        db.close()


def _record_failure(job, retry):
    with engine.begin() as db:
        if retry:
            db.execute(text("""UPDATE background_jobs SET status='PENDING',
              available_at=now()+interval '30 seconds',locked_at=NULL,error_code='JOB_FAILED'
              WHERE id=:id AND attempts=:attempt"""),
              {"id": job["id"], "attempt": job["attempts"]})
        else:
            db.execute(text("""UPDATE background_jobs SET status='FAILED',locked_at=NULL,error_code='JOB_FAILED'
              WHERE id=:id AND attempts=:attempt"""),
              {"id": job["id"], "attempt": job["attempts"]})
        if job["kind"] == "PROCESS_OCR":
            ocr_job_id = job["payload"].get("ocr_job_id")
            row = db.execute(text("""SELECT prescription_id,status FROM ocr_jobs WHERE id=:id"""),
                             {"id": ocr_job_id}).mappings().first()
            if row:
                if row["status"] == "COMPLETED":
                    db.execute(text("""UPDATE background_jobs SET status='COMPLETED',completed_at=now(),
                      locked_at=NULL,error_code=NULL WHERE id=:id"""), {"id": job["id"]})
                    return
                if retry:
                    db.execute(text("""UPDATE ocr_jobs SET status='PENDING',started_at=NULL
                      WHERE id=:id AND status!='COMPLETED'"""), {"id": ocr_job_id})
                else:
                    db.execute(text("""UPDATE ocr_jobs SET status='FAILED',error_message='OCR_PROCESSING_FAILED',
                      completed_at=now() WHERE id=:id AND status!='COMPLETED'"""), {"id": ocr_job_id})
                    prescription = db.execute(text("""UPDATE prescriptions SET status='FAILED',updated_at=now()
                      WHERE id=:id RETURNING original_file_url"""),
                      {"id": row["prescription_id"]}).mappings().first()
                    if prescription and prescription["original_file_url"]:
                        db.execute(BackgroundJob.__table__.insert().values(
                            kind="DELETE_FILE",
                            payload={"storage_key": prescription["original_file_url"]},
                            status="PENDING",
                        ))
                        db.execute(text("UPDATE prescriptions SET original_file_url=NULL WHERE id=:id"),
                                   {"id": row["prescription_id"]})


def _queue_expired_prescription_files():
    """Enqueue private-image deletion after prescription draft retention expires."""
    db = SessionLocal()
    try:
        active_prescriptions = select(OcrJobs.prescription_id).where(
            OcrJobs.status.in_(("PENDING", "PROCESSING"))
        )
        expired = (
            db.query(Prescriptions)
            .filter(
                Prescriptions.original_file_url.isnot(None),
                Prescriptions.expires_at.isnot(None),
                Prescriptions.expires_at <= text("now()"),
                ~Prescriptions.id.in_(active_prescriptions),
            )
            .order_by(Prescriptions.expires_at, Prescriptions.id)
            .with_for_update(skip_locked=True)
            .limit(50)
            .all()
        )
        for prescription in expired:
            db.add(BackgroundJob(
                kind="DELETE_FILE",
                payload={"storage_key": prescription.original_file_url},
                status="PENDING",
            ))
            prescription.original_file_url = None
        if expired:
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def run_once():
    _queue_expired_prescription_files()
    with engine.begin() as db:
        # Recover leases after a process restart (at-least-once delivery).
        expired = db.execute(text("""UPDATE background_jobs SET status = CASE WHEN attempts >= max_attempts THEN 'FAILED' ELSE 'PENDING' END,
          error_code='LEASE_EXPIRED', locked_at=NULL
          WHERE status='PROCESSING' AND locked_at < now() - interval '10 minutes'
          RETURNING kind,payload,status""")).mappings().all()
        for stale in expired:
            if stale["kind"] != "PROCESS_OCR":
                continue
            ocr_job_id = stale["payload"].get("ocr_job_id")
            ocr_state = db.execute(text("SELECT status FROM ocr_jobs WHERE id=:id"),
                                    {"id": ocr_job_id}).scalar()
            if ocr_state == "COMPLETED":
                db.execute(text("""UPDATE background_jobs SET status='COMPLETED',completed_at=now(),
                  error_code=NULL WHERE kind='PROCESS_OCR' AND payload->>'ocr_job_id'=:id"""),
                  {"id": ocr_job_id})
                continue
            if stale["status"] == "FAILED":
                row = db.execute(text("""SELECT prescription_id FROM ocr_jobs WHERE id=:id"""),
                                 {"id": ocr_job_id}).mappings().first()
                if row:
                    db.execute(text("""UPDATE ocr_jobs SET status='FAILED',error_message='OCR_PROCESSING_FAILED',
                      completed_at=now() WHERE id=:id AND status!='COMPLETED'"""), {"id": ocr_job_id})
                    prescription = db.execute(text("""UPDATE prescriptions SET status='FAILED',updated_at=now()
                      WHERE id=:id RETURNING original_file_url"""),
                      {"id": row["prescription_id"]}).mappings().first()
                    if prescription and prescription["original_file_url"]:
                        db.execute(BackgroundJob.__table__.insert().values(
                            kind="DELETE_FILE",
                            payload={"storage_key": prescription["original_file_url"]},
                            status="PENDING",
                        ))
                        db.execute(text("UPDATE prescriptions SET original_file_url=NULL WHERE id=:id"),
                                   {"id": row["prescription_id"]})
            else:
                db.execute(text("""UPDATE ocr_jobs SET status='PENDING',started_at=NULL
                  WHERE id=:id AND status!='COMPLETED'"""), {"id": ocr_job_id})
        job = db.execute(text("""UPDATE background_jobs SET status='PROCESSING', locked_at=now(), attempts=attempts+1
          WHERE id=(SELECT id FROM background_jobs WHERE status='PENDING' AND available_at<=now()
            ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
          RETURNING id,kind,payload,attempts,max_attempts""")).mappings().first()
    if job is None:
        return False
    try:
        if job['kind'] == 'DELETE_FILE':
            LocalPrivateStorage(settings.STORAGE_ROOT).delete(job['payload']['storage_key'])
        elif job['kind'] == 'PROCESS_OCR':
            _process_ocr(job['payload'])
        else:
            raise ValueError('UNSUPPORTED_JOB_KIND')
    except Exception as exc:
        logger.error(
            "Background job failed (id=%s, kind=%s, attempt=%s, error_type=%s)",
            job["id"], job["kind"], job["attempts"], type(exc).__name__,
        )
        _record_failure(job, retry=job['attempts'] < job['max_attempts'])
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
