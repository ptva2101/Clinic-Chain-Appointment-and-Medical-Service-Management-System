"""Authenticated HTTP contracts for cancellation and doctor replacement."""
import hmac
import os
from typing import Annotated

import httpx
from fastapi import Header, HTTPException


class ChangeRejected(Exception):
    pass


class ChangeUnavailable(Exception):
    pass


async def change_token(x_service_token: Annotated[str | None, Header()] = None):
    expected = os.getenv('APPOINTMENT_INTERNAL_TOKEN', '')
    if not expected or not x_service_token or not hmac.compare_digest(expected, x_service_token):
        raise HTTPException(status_code=401, detail='Internal service authentication required')


async def call_change(service, method, path, body=None, *, bearer=None):
    base = os.getenv(f'{service.upper()}_INTERNAL_URL', f'http://{service}:8000').rstrip('/')
    secret = os.getenv('APPOINTMENT_INTERNAL_TOKEN', '')
    headers = {'Authorization': f'Bearer {bearer}'} if bearer else {'X-Service-Token': secret}
    if not bearer and not secret:
        raise ChangeUnavailable('Appointment internal credential is missing')
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(method, base + path, headers=headers, json=body)
    except httpx.RequestError as exc:
        raise ChangeUnavailable(f'{service.title()} is temporarily unavailable; retry to resume') from exc
    if response.status_code >= 500:
        raise ChangeUnavailable(response.json().get('detail', f'{service} is unavailable'))
    if response.status_code >= 400:
        raise ChangeRejected(response.json().get('detail', f'{service} rejected the change'))
    return response.json() if response.content else None
