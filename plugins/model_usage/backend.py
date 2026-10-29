"""Compatibility adapter for the model usage business API."""
from plugins.model_usage import service


def handle(method: str, subpath: str, query: dict, body: dict) -> dict:
    route = subpath.strip("/")
    path = "/api/model-usage" if route == "records" else "/api/model-usage/" + route
    try:
        return service.api(method, path, query, body)
    except LookupError as exc:
        return {"ok": False, "error": str(exc), "__status__": 404}
    except (ValueError, TypeError) as exc:
        return {"ok": False, "error": str(exc), "__status__": 400}

