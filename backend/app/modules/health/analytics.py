"""Calendar summaries of persisted readings in the requested IANA timezone."""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from app.modules.health.errors import invalid
from app.modules.health.validation import UNITS


def bucket_start(day: date, granularity: str) -> date:
    if granularity == 'week':
        return day - timedelta(days=day.weekday())
    if granularity == 'month':
        return day.replace(day=1)
    return day


def bucket_end(start: date, granularity: str) -> date:
    if granularity == 'week':
        return start + timedelta(days=7)
    if granularity == 'month':
        return date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
    return start + timedelta(days=1)


def summarize(readings, filters):
    if filters.start >= filters.end or (filters.end - filters.start).days > 366:
        invalid('from', 'INVALID_OR_TOO_WIDE_DATE_RANGE')
    tz = ZoneInfo(filters.timezone)
    from_utc = datetime.combine(filters.start, datetime.min.time(), tzinfo=tz).astimezone(timezone.utc)
    to_utc = datetime.combine(filters.end, datetime.min.time(), tzinfo=tz).astimezone(timezone.utc)
    groups = defaultdict(list)
    excluded_reasons = defaultdict(int)
    for measured_at, value, secondary, unit in readings(filters.observation_type, from_utc, to_utc):
        value = Decimal(value) if value is not None else None
        secondary = Decimal(secondary) if secondary is not None else None
        if filters.observation_type == 'GLUCOSE':
            if unit == 'mg/dL' and value is not None:
                value /= Decimal(18)
            elif unit != 'mmol/L':
                excluded_reasons['UNKNOWN_UNIT'] += 1
                continue
        elif unit != UNITS[filters.observation_type]:
            excluded_reasons['UNKNOWN_UNIT'] += 1
            continue
        if value is None or not value.is_finite() or value <= 0:
            excluded_reasons['INVALID_VALUE'] += 1
            continue
        if filters.observation_type == 'BLOOD_PRESSURE' and (secondary is None or not secondary.is_finite() or secondary <= 0):
            excluded_reasons['INCOMPLETE_BLOOD_PRESSURE'] += 1
            continue
        if filters.observation_type != 'BLOOD_PRESSURE' and secondary is not None:
            excluded_reasons['UNEXPECTED_SECONDARY_VALUE'] += 1
            continue
        # The SQLite test adapter returns naive UTC values; PostgreSQL returns aware UTC.
        aware = measured_at if measured_at.tzinfo else measured_at.replace(tzinfo=timezone.utc)
        local_date = aware.astimezone(tz).date()
        groups[bucket_start(local_date, filters.granularity)].append((value, secondary))

    def stats(values):
        if not values:
            return None, None, None
        return ((sum(values) / len(values)).quantize(Decimal('.0001'), rounding=ROUND_HALF_UP),
                min(values), max(values))

    buckets = []
    cursor = bucket_start(filters.start, filters.granularity)
    while cursor < filters.end:
        rows = groups[cursor]
        avg, low, high = stats([row[0] for row in rows])
        second_avg, second_low, second_high = stats([row[1] for row in rows if row[1] is not None])
        next_cursor = bucket_end(cursor, filters.granularity)
        buckets.append({'period_start': cursor, 'period_end': next_cursor, 'count': len(rows),
                        'average': avg, 'minimum': low, 'maximum': high,
                        'secondary_average': second_avg, 'secondary_minimum': second_low,
                        'secondary_maximum': second_high})
        cursor = next_cursor
    return {'observation_type': filters.observation_type, 'from': filters.start, 'to': filters.end,
            'granularity': filters.granularity, 'timezone': filters.timezone,
            'unit': UNITS[filters.observation_type], 'excluded_count': sum(excluded_reasons.values()),
            'excluded_reasons': dict(sorted(excluded_reasons.items())), 'buckets': buckets}
