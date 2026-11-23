"""Independent calendar and arithmetic checks for the saved-reading analytics API."""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

import pytest

from app.modules.health.models import HealthObservations
from test_m1_health import users, entry, ROOT


PATH = ROOT + '/analytics'


def query(client, headers, metric='HEART_RATE', **kwargs):
    params = {'observation_type': metric, 'from': '2020-02-28', 'to': '2020-03-03', **kwargs}
    response = client.get(PATH, params=params, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_calendar_buckets_are_continuous_owner_scoped_and_use_measured_time(client, users):
    a, b = users[0][1], users[1][1]
    entry(client, a, [
        {'observation_type': 'HEART_RATE', 'value': 60, 'measured_at': '2020-02-29T16:59:00Z'},
        {'observation_type': 'HEART_RATE', 'value': 80, 'measured_at': '2020-02-29T17:00:00Z'},
        {'observation_type': 'HEART_RATE', 'value': 100, 'measured_at': '2020-03-01T16:59:00Z'},
        {'observation_type': 'HEART_RATE', 'value': 120, 'measured_at': '2020-03-02T17:00:00Z'},
    ], recorded_at='2019-01-01T00:00:00Z')
    entry(client, b, [{'observation_type': 'HEART_RATE', 'value': 250,
                       'measured_at': '2020-02-29T17:00:00Z'}])
    day = query(client, a)
    assert day['unit'] == 'bpm'
    assert [(x['period_start'], x['count'], x['average']) for x in day['buckets']] == [
        ('2020-02-28', 0, None), ('2020-02-29', 1, 60),
        ('2020-03-01', 2, 90), ('2020-03-02', 0, None),
    ]
    assert all(x['secondary_average'] is None for x in day['buckets'])
    assert query(client, a, granularity='week')['buckets'][0]['period_start'] == '2020-02-24'
    assert [(x['period_start'], x['count']) for x in query(client, a, granularity='month')['buckets']] == [
        ('2020-02-01', 1), ('2020-03-01', 2),
    ]
    assert query(client, b)['buckets'][2]['average'] == 250


def test_bp_two_series_glucose_legacy_conversion_and_exclusions(client, users, db_session):
    owner, headers = users[0]
    result = entry(client, headers, [
        {'observation_type': 'BLOOD_PRESSURE', 'value': 120, 'secondary_value': 80,
         'measured_at': '2020-02-29T00:00:00Z'},
        {'observation_type': 'BLOOD_PRESSURE', 'value': 123, 'secondary_value': 83,
         'measured_at': '2020-02-29T01:00:00Z'},
        {'observation_type': 'GLUCOSE', 'value': 5, 'unit': 'mmol/L',
         'measured_at': '2020-02-29T00:00:00Z'},
    ])
    db_session.add_all([
        HealthObservations(user_id=owner.id, entry_id=UUID(result['id']),
                           observation_type='GLUCOSE', value=Decimal('90'), unit='mg/dL',
                           measured_at=datetime(2020, 2, 29, 1, tzinfo=timezone.utc)),
        HealthObservations(user_id=owner.id, entry_id=UUID(result['id']),
                           observation_type='GLUCOSE', value=Decimal('42'), unit='UNKNOWN',
                           measured_at=datetime(2020, 2, 29, 2, tzinfo=timezone.utc)),
        HealthObservations(user_id=owner.id, entry_id=UUID(result['id']),
                           observation_type='BLOOD_PRESSURE', value=Decimal('190'), unit='mmHg',
                           measured_at=datetime(2020, 2, 29, 2, tzinfo=timezone.utc)),
    ])
    db_session.commit()
    bp = query(client, headers, metric='BLOOD_PRESSURE')['buckets'][1]
    assert (bp['count'], bp['average'], bp['minimum'], bp['maximum']) == (2, 121.5, 120, 123)
    assert (bp['secondary_average'], bp['secondary_minimum'], bp['secondary_maximum']) == (81.5, 80, 83)
    assert query(client, headers, metric='BLOOD_PRESSURE')['excluded_count'] == 1
    assert query(client, headers, metric='BLOOD_PRESSURE')['excluded_reasons'] == {'INCOMPLETE_BLOOD_PRESSURE': 1}
    glucose = query(client, headers, metric='GLUCOSE')
    assert glucose['unit'] == 'mmol/L'
    assert glucose['buckets'][1]['count'] == 2
    assert glucose['buckets'][1]['average'] == 5
    assert glucose['excluded_count'] == 1
    assert glucose['excluded_reasons'] == {'UNKNOWN_UNIT': 1}


@pytest.mark.parametrize('change', [
    {'from': '2020-02-28T00:00:00Z'}, {'to': '2020-02-28'},
    {'from': '2020-01-01', 'to': '2021-01-02'}, {'granularity': 'quarter'},
    {'timezone': 'Unknown/Zone'}, {'observation_type': 'SPO2'},
])
def test_invalid_query_rejected(client, users, change):
    params = {'observation_type': 'HEART_RATE', 'from': '2020-02-28', 'to': '2020-03-03', **change}
    response = client.get(PATH, params=params, headers=users[0][1])
    assert response.status_code == 422, response.text


def test_dst_boundaries_are_local_dates_not_24_hour_blocks(client, users):
    headers = users[0][1]
    entry(client, headers, [
        {'observation_type': 'WEIGHT', 'value': 70, 'measured_at': '2020-03-08T04:59:00Z'},
        {'observation_type': 'WEIGHT', 'value': 71, 'measured_at': '2020-03-08T05:00:00Z'},
        {'observation_type': 'WEIGHT', 'value': 72, 'measured_at': '2020-03-09T03:59:00Z'},
        {'observation_type': 'WEIGHT', 'value': 73, 'measured_at': '2020-03-09T04:00:00Z'},
    ])
    data = query(client, headers, metric='WEIGHT', timezone='America/New_York',
                 **{'from': '2020-03-08', 'to': '2020-03-09'})
    assert len(data['buckets']) == 1
    assert (data['buckets'][0]['count'], data['buckets'][0]['average']) == (2, 71.5)


def test_fall_dst_day_has_25_hours(client, users):
    headers = users[0][1]
    entry(client, headers, [
        {'observation_type': 'WEIGHT', 'value': 70, 'measured_at': '2020-11-01T03:59:00Z'},
        {'observation_type': 'WEIGHT', 'value': 71, 'measured_at': '2020-11-01T04:00:00Z'},
        {'observation_type': 'WEIGHT', 'value': 72, 'measured_at': '2020-11-02T04:59:00Z'},
        {'observation_type': 'WEIGHT', 'value': 73, 'measured_at': '2020-11-02T05:00:00Z'},
    ])
    data = query(client, headers, metric='WEIGHT', timezone='America/New_York',
                 **{'from': '2020-11-01', 'to': '2020-11-02'})
    assert (data['buckets'][0]['count'], data['buckets'][0]['average']) == (2, 71.5)


def test_exclusion_reasons_are_counted_once_per_row(client, users, db_session):
    owner, headers = users[0]
    item = entry(client, headers, [], title='Legacy values')
    when = datetime(2020, 2, 29, tzinfo=timezone.utc)
    for value, secondary, unit in [(0, None, 'bpm'), (60, 30, 'bpm'), (70, None, 'UNKNOWN')]:
        db_session.add(HealthObservations(user_id=owner.id, entry_id=UUID(item['id']),
            observation_type='HEART_RATE', value=Decimal(value), secondary_value=secondary,
            unit=unit, measured_at=when))
    db_session.commit()
    data = query(client, headers)
    assert data['excluded_count'] == 3
    assert data['excluded_reasons'] == {'INVALID_VALUE': 1, 'UNEXPECTED_SECONDARY_VALUE': 1, 'UNKNOWN_UNIT': 1}
    assert all(bucket['count'] == 0 for bucket in data['buckets'])


def test_analytics_access_and_366_day_limit(client, users):
    params = {'observation_type': 'HEART_RATE', 'from': '2020-01-01', 'to': '2021-01-01'}
    assert client.get(PATH, params=params).status_code == 401
    guest = client.post('/api/v1/guest-sessions', json={
        'consent_accepted': True, 'consent_version': 'guest-processing-v1',
    }).json()
    assert client.get(PATH, params=params, headers={'X-Guest-Token': guest['guest_token']}).status_code == 403
    result = client.get(PATH, params=params, headers=users[0][1])
    assert result.status_code == 200, result.text
    assert len(result.json()['buckets']) == 366
