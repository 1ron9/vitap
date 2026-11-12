"""Private local storage. Authorization belongs to the calling service."""
from pathlib import Path
from uuid import uuid4

class LocalPrivateStorage:
    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, key: str) -> Path:
        # Only server-generated opaque keys; never accept filenames/URLs.
        if len(key) != 32 or any(c not in '0123456789abcdef' for c in key):
            raise ValueError('Invalid storage key')
        path = (self.root / key).resolve()
        if path.parent != self.root:
            raise ValueError('Invalid storage path')
        return path

    def put(self, content: bytes) -> str:
        key = uuid4().hex
        self.path(key).write_bytes(content)
        return key

    def read(self, key: str) -> bytes:
        return self.path(key).read_bytes()

    def delete(self, key: str):
        self.path(key).unlink(missing_ok=True)
