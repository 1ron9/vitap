"""Minimal internal catalog facade for M1 course selection; no DDI inference."""
from app.modules.medication.models import Drugs, Prescriptions, PrescriptionItems
from app.modules.health.errors import missing, conflict


def drug(db, drug_id):
    row = db.get(Drugs, drug_id)
    if row is None:
        missing()
    return row


def confirmed_item(db, owner, item_id):
    row = (db.query(PrescriptionItems, Prescriptions).join(Prescriptions, PrescriptionItems.prescription_id == Prescriptions.id)
           .filter(Prescriptions.user_id == owner, PrescriptionItems.id == item_id).with_for_update().first())
    if row is None:
        missing()
    item, prescription = row
    if prescription.status != 'CONFIRMED' or item.resolution_status != 'MATCHED' or not item.drug_id:
        conflict('Khoản mục cần thuộc đơn đã lưu và đã nhận diện')
    return item


def options(db, owner, query='', source_items=False):
    if source_items:
        q = (db.query(PrescriptionItems).join(Prescriptions).join(Drugs, Drugs.id == PrescriptionItems.drug_id)
             .filter(Prescriptions.user_id == owner, Prescriptions.status == 'CONFIRMED',
                     PrescriptionItems.resolution_status == 'MATCHED'))
    else:
        q = db.query(Drugs)
    if query:
        q = q.filter(Drugs.brand_name.ilike('%' + query.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%', escape='\\'))
    return q.order_by(Drugs.brand_name, PrescriptionItems.id if source_items else Drugs.id)
