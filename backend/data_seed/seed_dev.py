"""Idempotent synthetic fixtures. Run AFTER alembic upgrade head.

python -m data_seed.seed_dev
Never use these records as medical evidence.
"""
from sqlalchemy import text
from app.core.database import engine

def seed():
    with engine.begin() as db:
        db.execute(text("""INSERT INTO drug_sources (id,source_name,version,license_info)
          VALUES ('00000000-0000-4000-8000-000000000001','SYNTHETIC_DEV_FIXTURE','dev-1','Not medical evidence') ON CONFLICT (id) DO NOTHING"""))
        for n in (1,2):
            ingredient=f'10000000-0000-4000-8000-{n:012d}'
            drug=f'20000000-0000-4000-8000-{n:012d}'
            db.execute(text('INSERT INTO ingredients (id,name,normalized_name) VALUES (:id,:name,:normalized) ON CONFLICT (id) DO NOTHING'), {'id':ingredient,'name':f'Demo ingredient {n}','normalized':f'demo ingredient {n}'})
            db.execute(text("INSERT INTO drugs (id,brand_name,normalized_brand_name,source_id) VALUES (:id,:name,:normalized,'00000000-0000-4000-8000-000000000001') ON CONFLICT (id) DO NOTHING"), {'id':drug,'name':f'Demo product {n}','normalized':f'demo product {n}'})
            db.execute(text('INSERT INTO drug_ingredients (drug_id,ingredient_id) VALUES (:drug,:ingredient) ON CONFLICT DO NOTHING'), {'drug':drug,'ingredient':ingredient})

if __name__ == '__main__':
    seed()
    print('Synthetic development fixtures loaded; no interaction coverage asserted.')
