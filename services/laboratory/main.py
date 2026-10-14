from common.app import create_app
from common.history import history_router

app = create_app(
    "laboratory",
    "Laboratory orders, sample processing, and test results.",
)
app.include_router(history_router("laboratory"))
