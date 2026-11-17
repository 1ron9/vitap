from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
from app.modules.health.errors import invalid

UNITS = {'BLOOD_PRESSURE': 'mmHg', 'HEART_RATE': 'bpm', 'WEIGHT': 'kg', 'GLUCOSE': 'mmol/L'}


def now():
    return datetime.now(timezone.utc)


def aware(value):
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)  # SQLite test adapter only


def today():
    return now().astimezone(timezone(timedelta(hours=7))).date()


def past(value, field):
    if value is None or aware(value) > now():
        invalid(field, 'FUTURE_OR_NULL_TIMESTAMP')


def date_not_future(value, field):
    if value and value > today():
        invalid(field, 'FUTURE_DATE')


def observation_values(data, recorded_at, existing=None):
    data = dict(data)
    if 'unit' in data and data['unit'] is None:
        invalid('unit', 'NULL_NOT_ALLOWED')
    kind = data.get('observation_type', existing.observation_type if existing else None)
    if kind not in UNITS:
        invalid('observation_type', 'UNSUPPORTED_METRIC')
    if existing:
        for key in ('value', 'unit', 'measured_at'):
            if key in data and data[key] is None:
                invalid(key, 'NULL_NOT_ALLOWED')
        # Metadata-only patches do not renormalize legacy glucose.
        base = {'value': existing.value, 'secondary_value': existing.secondary_value,
                'unit': existing.unit, 'measured_at': existing.measured_at}
        if kind == 'GLUCOSE' and 'unit' in data and 'value' not in data:
            invalid('value', 'REQUIRED_WITH_GLUCOSE_UNIT')
        base.update(data)
    else:
        base = {'secondary_value': None, 'unit': None, 'measured_at': recorded_at, **data}
    if base.get('measured_at') is None:
        if 'measured_at' in data:
            invalid('measured_at', 'NULL_NOT_ALLOWED')
        base['measured_at'] = recorded_at
    past(base['measured_at'], 'measured_at')
    value, secondary = base['value'], base.get('secondary_value')
    if value is None or value <= 0:
        invalid('value', 'POSITIVE_NUMBER_REQUIRED')
    if kind == 'BLOOD_PRESSURE':
        if secondary is None or secondary <= 0:
            invalid('secondary_value', 'REQUIRED_FOR_BLOOD_PRESSURE')
    elif secondary is not None:
        invalid('secondary_value', 'ONLY_FOR_BLOOD_PRESSURE')
    result = {'value': value, 'secondary_value': secondary, 'unit': base['unit'] or UNITS[kind],
              'measured_at': base['measured_at']}
    if kind == 'GLUCOSE':
        if result['unit'] not in ('mg/dL', 'mmol/L'):
            invalid('unit', 'INVALID_UNIT')
        if not existing or 'value' in data:
            raw = value
            normalized = (raw / Decimal(18) if result['unit'] == 'mg/dL' else raw).quantize(Decimal('.0001'), rounding=ROUND_HALF_UP)
            if normalized <= 0 or normalized >= Decimal('100000000'):
                invalid('value', 'CONVERSION_OUT_OF_RANGE')
            result.update(entered_value=raw, entered_unit=result['unit'], value=normalized, unit='mmol/L')
    elif result['unit'] != UNITS[kind]:
        invalid('unit', 'INVALID_UNIT')
    return result
