import re

def fix_db_py():
    with open("api/db.py", "r", encoding="utf-8") as f:
        content = f.read()
    resolved = content.replace(
        "<<<<<<< HEAD\n            \"ALTER TABLE users ADD COLUMN nickname TEXT\",\n            \"ALTER TABLE users ADD COLUMN settings_json TEXT\",\n=======\n            \"ALTER TABLE users RENAME COLUMN email TO username\",\n>>>>>>> 1b810b10eef9400cc3738def464f6c5241b0eb72",
        "            \"ALTER TABLE users ADD COLUMN nickname TEXT\",\n            \"ALTER TABLE users ADD COLUMN settings_json TEXT\",\n            \"ALTER TABLE users RENAME COLUMN email TO username\","
    )
    with open("api/db.py", "w", encoding="utf-8") as f:
        f.write(resolved)

def fix_ui_jsx():
    with open("design/ui.jsx", "r", encoding="utf-8") as f:
        content = f.read()
    resolved = re.sub(r'<<<<<<< HEAD.*?=======', "    refresh: <><polyline points=\"23 4 23 10 17 10\"/><path d=\"M20.49 15a9 9 0 1 1-2.12-9.36L23 10\"/></>,\n    heart: <path d=\"M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z\"/>,\n    'heart-fill': <path fill=\"currentColor\" stroke=\"none\" d=\"M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z\"/>,\n", content, flags=re.DOTALL)
    resolved = re.sub(r'>>>>>>> 1b810b10eef9400cc3738def464f6c5241b0eb72', "", resolved)
    with open("design/ui.jsx", "w", encoding="utf-8") as f:
        f.write(resolved)

fix_db_py()
fix_ui_jsx()
print("Fixed db.py and ui.jsx")
