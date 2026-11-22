class HealthError(Exception):
    def __init__(self, status: int, code: str, message: str, field: str | None = None, reason: str | None = None):
        self.status_code, self.code, self.message = status, code, message
        self.details = [{'field': field, 'reason': reason or code}] if field else []


def invalid(field, reason='INVALID_VALUE'):
    raise HealthError(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', field, reason)


def missing():
    raise HealthError(404, 'RESOURCE_NOT_FOUND', 'Không tìm thấy tài nguyên')


def conflict(message):
    raise HealthError(409, 'INVALID_RESOURCE_STATE', message)
