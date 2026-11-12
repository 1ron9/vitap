from uuid import uuid4
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from app.modules.auth.router import AuthError

def install_error_handlers(app):
    @app.middleware("http")
    async def request_id(request, call_next):
        request.state.request_id = str(uuid4())
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    def error(request, status, code, message, details=None, headers=None):
        return JSONResponse(status_code=status, headers=headers, content={"error": {
            "code": code, "message": message, "details": details or [],
            "request_id": getattr(request.state, "request_id", str(uuid4()))}})

    @app.exception_handler(AuthError)
    async def auth(request, exc):
        return error(request, exc.status_code, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def validation(request, exc):
        # Never echo input values (passwords/tokens/health information).
        details = [{"field": ".".join(str(x) for x in e["loc"]), "reason": e["type"]} for e in exc.errors()]
        return error(request, 422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ", details)

    @app.exception_handler(HTTPException)
    async def http(request, exc):
        codes = {404: "RESOURCE_NOT_FOUND", 401: "AUTH_REQUIRED", 403: "FORBIDDEN", 503: "DEPENDENCY_UNAVAILABLE"}
        return error(request, exc.status_code, codes.get(exc.status_code, "HTTP_ERROR"), str(exc.detail), headers=exc.headers)

    @app.exception_handler(Exception)
    async def unexpected(request, exc):
        return error(request, 500, "INTERNAL_ERROR", "Không thể xử lý yêu cầu")
