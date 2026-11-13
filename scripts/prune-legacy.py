import json, subprocess, re
out = subprocess.run(["node", "scripts/lint.mjs"], capture_output=True, text=True).stderr
clean = set(re.findall(r"^(\S+):0  \[design-legacy\]", out, re.M))
d = json.load(open("scripts/design-legacy.json"))
d["files"] = [f for f in d["files"] if f not in clean]
json.dump(d, open("scripts/design-legacy.json", "w"), indent=2)
print("removed", len(clean), "left", len(d["files"]))
