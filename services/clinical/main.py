from common.app import create_app

app = create_app(
    "clinical",
    "Encounters, diagnoses, prescriptions, and treatment orders.",
)
