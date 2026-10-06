import subprocess, sys, time, os

project = r"C:\Users\haash\Downloads\final project"
frontend_dir = os.path.join(project, "frontend")
log = os.path.join(project, ".freebuff", "frontend.log")
errlog = log + ".err"
node_exe = os.path.join(frontend_dir, "node_modules", "node", "bin", "node.exe")

# Find node.exe
if not os.path.exists(node_exe):
    node_exe = "node"

vite_js = os.path.join(frontend_dir, "node_modules", "vite", "bin", "vite.js")

with open(log, "w") as lf, open(errlog, "w") as ef:
    p = subprocess.Popen(
        [node_exe, vite_js, "--port", "5173", "--host", "127.0.0.1"],
        cwd=frontend_dir,
        stdout=lf, stderr=ef,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    )
print(f"Frontend PID: {p.pid}")
time.sleep(6)
poll = p.poll()
if poll is None:
    print("Server is running")
else:
    print(f"Server exited with code {poll}")
    with open(errlog) as f:
        print("STDERR:", f.read()[-800:])
