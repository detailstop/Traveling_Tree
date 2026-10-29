"""Adapter for pixel art API and reader asset resolution."""
from plugins.pixel_art import service


def assets_payload() -> dict:
    """Resolve reader assets without making the plugin depend on book_reader."""
    return service.assets_payload()


def handle(method: str, subpath: str, query: dict, body: dict) -> dict:
    path = "/api/pixel/" + subpath.strip("/")
    try:
        return service.api(method, path, query, body)
    except LookupError as exc:
        return {"ok": False, "error": str(exc), "__status__": 404}
    except (ValueError, TypeError) as exc:
        return {"ok": False, "error": str(exc), "__status__": 400}

