import os, shutil, time

OUTPUTS = "outputs/"
REPORTS = "reports/"

while True:
    for f in os.listdir(OUTPUTS):
        if f.endswith(".pdf"):
            src = os.path.join(OUTPUTS, f)
            dst = os.path.join(REPORTS, f)
            if not os.path.exists(dst):
                shutil.copy(src, dst)
                print(f"Copied {f} to reports folder")
    time.sleep(5)