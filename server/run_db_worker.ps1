Set-Location -Path $PSScriptRoot
& "$PSScriptRoot\.venv\Scripts\Activate.ps1"
& "$PSScriptRoot\.venv\Scripts\python.exe" db_worker.py
