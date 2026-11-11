"""Import every application model before using metadata or Alembic."""
from app.modules.auth import models as auth
from app.modules.health import models as health
from app.modules.medication import models as medication
from app.modules.ai_assistant import models as ai_assistant
from app.core.database import Base
from app.workers import models as workers
