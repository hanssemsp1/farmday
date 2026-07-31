Set objShell = CreateObject("WScript.Shell")
objShell.Run "cmd /c cd /d ""C:\Users\서현주\OneDrive\Desktop\Agent\claude"" && node scripts\watch-upload.js >> scripts\watch-upload.log 2>&1", 0, False
