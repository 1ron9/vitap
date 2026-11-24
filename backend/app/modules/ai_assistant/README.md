# ai_assistant

The main app mounts the chat session, message and feedback API at `/api/v1/ai`.
It uses the shared Auth consent dependency and a request-scoped PostgreSQL AsyncSession.
The interaction explanation route is registered when real M2 ports are wired.
See the development guide for Compose initialization and provider settings.
