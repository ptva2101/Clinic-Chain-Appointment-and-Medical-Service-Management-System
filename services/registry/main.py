from common.app import create_app
from registry.api import router

app = create_app(
    "registry",
    "Patients, staff, branches, medical services, and insurance catalogues.",
)
app.include_router(router)
