from common.app import create_app

app = create_app(
    "appointment",
    "Appointments, check-in, waiting queues, and booking orchestration.",
)
