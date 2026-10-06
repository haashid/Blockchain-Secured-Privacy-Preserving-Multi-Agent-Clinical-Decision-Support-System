import subprocess, sys, time, os
os.chdir(r"C:\Users\haash\Downloads\final project")
log = r".freebuff\backend.log"
errlog = r".freebuff\backend.log.err"
with open(log, "w") as lf, open(errlog, "w") as ef:
    p = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app:app", "--host", "127.0.0.1", "--port", "8000"],
        stdout=lf, stderr=ef, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    )
print(f"Backend PID: {p.pid}")
# Wait a bit and check
time.sleep(5)
poll = p.poll()
if poll is None:
    print("Server is running")
else:
    print(f"Server exited with code {poll}")
    with open(errlog) as f:
        print("STDERR:", f.read()[-500:])
