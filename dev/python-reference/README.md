# Developer-only Python reference

These are the v1.0.0 implementation and tests, retained as an independent oracle for the Node.js port. They are **not called by run.bat, setup.bat, tool.js or npm test**. End users do not install Python or this directory's requirements.

The read-only comparison uses the independent `lzokay` decoder and original Python bytecode builder:

```powershell
python dev/python-reference/dev_verify.py ORIGINAL.upk NODE_PATCHED.upk --exe ORIGINAL.exe --patched-exe NODE_PATCHED.exe
```

Do not use the archived `tool.py` to manage your live installation. Use the root `run.bat` and keep existing `backups/` in the root tool directory.
