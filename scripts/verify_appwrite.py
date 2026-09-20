from pathlib import Path
import json
import urllib.error
import urllib.request


def load_env(path: Path) -> dict[str, str]:
    vals: dict[str, str] = {}
    if not path.exists():
        return vals
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" not in line or line.strip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        vals[key.strip()] = value.strip().strip('"').strip("'")
    return vals


root = load_env(Path(".env.local"))
web = load_env(Path("apps/web/.env.local"))
env = {**root}
for key, value in web.items():
    if value:
        env[key] = value

endpoint = env.get("NEXT_PUBLIC_APPWRITE_ENDPOINT", "").rstrip("/")
project = env.get("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "")
api_key = env.get("APPWRITE_API_KEY", "")
db_id = env.get("APPWRITE_DATABASE_ID", "kidar")

print("endpoint_ok", bool(endpoint))
print("project", project)
print("root_api_key", "SET" if root.get("APPWRITE_API_KEY") else "EMPTY")
print("web_api_key", "SET" if web.get("APPWRITE_API_KEY") else "EMPTY")
print("effective_api_key", "SET" if api_key else "EMPTY")

if not endpoint or not project or not api_key:
    raise SystemExit(1)


def req(path: str):
    request = urllib.request.Request(
        endpoint + path,
        headers={
            "X-Appwrite-Project": project,
            "X-Appwrite-Key": api_key,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode())


try:
    databases = req("/databases")
    print("databases", [item.get("$id") for item in databases.get("databases", [])])
    collections = req(f"/databases/{db_id}/collections")
    print("collections", [item.get("$id") for item in collections.get("collections", [])])
    for collection_id in [item.get("$id") for item in collections.get("collections", [])]:
        attrs = req(f"/databases/{db_id}/collections/{collection_id}/attributes")
        names = [item.get("key") for item in attrs.get("attributes", [])]
        print(f"attrs:{collection_id}", names)
    buckets = req("/storage/buckets")
    print("buckets", [item.get("$id") for item in buckets.get("buckets", [])])
except urllib.error.HTTPError as error:
    body = error.read().decode(errors="replace")
    content_type = error.headers.get("content-type", "")
    print("http_error", error.code, "content_type", content_type)
    try:
        payload = json.loads(body)
        print(
            "error_type",
            payload.get("type") or "unknown",
            "message",
            (payload.get("message") or "")[:120],
        )
    except json.JSONDecodeError:
        lowered = body.lower()
        if "cloudflare" in lowered:
            print("error_hint cloudflare_block")
        elif "1010" in body:
            print("error_hint code_1010")
        else:
            print("error_hint non_json", len(body))
    raise SystemExit(1)
