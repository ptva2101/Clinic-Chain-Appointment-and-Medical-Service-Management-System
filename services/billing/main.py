from common.app import create_app
from common.history import history_router

app = create_app(
    "billing",
    "Invoices, insurance-adjusted charges, simulated payments, and refunds.",
)
app.include_router(history_router("billing"))
