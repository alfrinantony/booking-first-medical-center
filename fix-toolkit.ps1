# Stop the service if it's running
Write-Host "Stopping EIDAToolkitService..."
Stop-Service -Name "EIDAToolkitService" -Force -ErrorAction SilentlyContinue

# Kill any leftover processes
Write-Host "Killing background processes..."
Stop-Process -Name "EIDAToolkitService" -Force -ErrorAction SilentlyContinue

# Wait for them to fully exit
Start-Sleep -Seconds 2

# Define paths
$sourceDir = "C:\Users\alfri\Downloads\EmiratesIDCardToolkitService_64\EmiratesIDCardToolkitService_64\*"
$targetDir = "C:\Program Files (x86)\Emirates ID Card Toolkit Service"

# Copy the updated files into the Program Files directory
Write-Host "Copying updated toolkit files to Program Files..."
Copy-Item -Path $sourceDir -Destination $targetDir -Force -Recurse

# Start the service again
Write-Host "Starting EIDAToolkitService as LocalSystem..."
Start-Service -Name "EIDAToolkitService"

# Wait a few seconds for it to bind the port
Start-Sleep -Seconds 3

# Check if it's listening
$listening = netstat -ano | findstr 9004
Write-Host "Port 9004 status:"
Write-Host $listening

Write-Host "`nAll done! The ICA Toolkit has been updated and restarted with Administrator privileges."
Write-Host "Please close this window and try reading your Emirates ID in the web application."

# Pause so the user can see the output
Read-Host "Press Enter to exit"
