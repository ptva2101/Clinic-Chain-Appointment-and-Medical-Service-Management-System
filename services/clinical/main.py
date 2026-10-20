from common.app import create_app
from common.history import history_router
from clinical.api import router

app = create_app(
    "clinical",
    "Encounters, diagnoses, prescriptions, and treatment orders.",
)
app.include_router(history_router("clinical"))
app.include_router(router)
