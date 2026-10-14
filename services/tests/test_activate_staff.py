from demo_import.activate_staff import choose_action


PROFILE = {
    "staff_code": "BS001", "role": "doctor", "identity_account_id": None,
}
ACCOUNT = {
    "id": "account-1", "role": "doctor", "username": "BS001",
    "subject_id": "BS001", "is_active": True, "registration_pending": False,
}


def test_activation_plan_creates_only_unlinked_profiles_without_accounts():
    assert choose_action(PROFILE, []) == "create"
    assert choose_action({**PROFILE, "identity_account_id": "missing"}, []) == "conflict"
    assert choose_action(PROFILE, [ACCOUNT]) == "repair"
    assert choose_action({**PROFILE, "identity_account_id": "account-1"}, [ACCOUNT]) == "existing"


def test_activation_plan_preserves_other_accounts_and_admin_disabled_state():
    assert choose_action(PROFILE, [ACCOUNT, {**ACCOUNT, "id": "account-2"}]) == "conflict"
    assert choose_action(PROFILE, [{**ACCOUNT, "subject_id": "BS999"}]) == "conflict"
    assert choose_action(PROFILE, [{**ACCOUNT, "is_active": False}]) == "disabled"
    assert choose_action(PROFILE, [{**ACCOUNT, "is_active": False,
                                    "registration_pending": True}]) == "repair"
    assert choose_action({**PROFILE, "identity_account_id": "another"}, [ACCOUNT]) == "conflict"
