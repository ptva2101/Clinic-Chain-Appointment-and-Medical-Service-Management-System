from common.app import create_app

app = create_app(
    "billing",
    "Invoices, insurance-adjusted charges, simulated payments, and refunds.",
)
