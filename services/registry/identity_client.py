"""Compatibility import for the shared Identity RPC client."""

from common.identity_client import IdentityClient, IdentityUnavailable, InvalidIdentityToken

__all__ = ["IdentityClient", "IdentityUnavailable", "InvalidIdentityToken"]
