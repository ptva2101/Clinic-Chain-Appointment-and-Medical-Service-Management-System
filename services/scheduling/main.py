from common.app import create_app

app = create_app(
    "scheduling",
    "Doctor schedules, available appointment slots, and temporary slot holds.",
)
