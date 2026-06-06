$appToken = "1956787038259952|91cec59e71b9a9c95636a491e71c6762"
$userToken = "EAAbzrZCxRCvABRtawiRNZCrIQMd95NPzDT9unYqeXa9tWGaoVfhSPNrSZBhLqbwMwXWCsBg7mPmkZAHa8HoM3LhnwZCdEDY8aa1pIukkjAeZCDWdPpQMEnXPI8i8ZBjZC0KGK3PBgjrCyHnlLaRNxU1fZC2enpWfK1cnZCXqWfJtaVKMDFcL0DJF8GUuNmB2c6zDUy6GMnCcxrF91Ps4VGLbSY0LXfxl6yCjOX4Er7JbbNZA8dFRmRW0fWHi8ZBuEdJcaKorZBfqeE9izGYDHvlsZD"
$pageToken = "EAAbzrZCxRCvABRsQZCZC8n9OoWLrdtVv1mRudlxfUZAWERCvZCZBdC7R4wPKr30ToNmkZCKKcXQDr4kOLJFWsiZAhXnM14oCgEtbgyvz0ZAZCLzsusXk7pslr9eO5fZAGmu1ZCM66UxFvxG3HUprqDIFG8hP7duZC0sLyZB9cFdEfIxfCJyVfAyTkDYX2MaTFiyk4U6mSZBsorTFAayG8ygZBIDPnEIW1NYRZBZCDZAlbBKjMifZAWoZD"

Write-Host "`n=== Step 1: Find WhatsApp Business Accounts linked to this user ===" -ForegroundColor Cyan
$businesses = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/me/businesses" -Method GET -Body @{ access_token = $userToken }
Write-Host ($businesses | ConvertTo-Json -Depth 3)

Write-Host "`n=== Step 2: Get WABAs for each business ===" -ForegroundColor Cyan
foreach ($biz in $businesses.data) {
    Write-Host "Business: $($biz.name) ($($biz.id))" -ForegroundColor Yellow
    try {
        $wabas = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/$($biz.id)/owned_whatsapp_business_accounts" -Method GET -Body @{ access_token = $userToken }
        Write-Host "  Owned WABAs: $($wabas | ConvertTo-Json -Depth 2)"
    } catch { Write-Host "  No owned WABAs" }
    try {
        $wabas2 = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/$($biz.id)/client_whatsapp_business_accounts" -Method GET -Body @{ access_token = $userToken }
        Write-Host "  Client WABAs: $($wabas2 | ConvertTo-Json -Depth 2)"
    } catch { Write-Host "  No client WABAs" }
}

Write-Host "`n=== Step 3: Get WABAs accessible from user token ===" -ForegroundColor Cyan
try {
    $allWabas = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/me/whatsapp_business_accounts" -Method GET -Body @{ access_token = $userToken }
    Write-Host ($allWabas | ConvertTo-Json -Depth 3)
} catch { Write-Host "Not accessible from user token" }

Write-Host "`n=== Step 4: Check phone number 518094511384485 directly ===" -ForegroundColor Cyan
try {
    $phone = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/518094511384485" -Method GET -Body @{ fields = "display_phone_number,verified_name,id"; access_token = $pageToken }
    Write-Host ($phone | ConvertTo-Json)
} catch {
    Write-Host "Error: $_"
}

Write-Host "`n=== Step 5: Check existing app subscriptions ===" -ForegroundColor Cyan
$subs = Invoke-RestMethod -Uri "https://graph.facebook.com/v21.0/1956787038259952/subscriptions" -Method GET -Body @{ access_token = $appToken }
Write-Host ($subs | ConvertTo-Json -Depth 4)

Write-Host "`n=== Step 6: Post a test webhook to our own endpoint ===" -ForegroundColor Cyan
$testPayload = @{
    object = "whatsapp_business_account"
    entry = @(@{
        id = "2307111309557939"
        changes = @(@{
            value = @{
                messaging_product = "whatsapp"
                metadata = @{
                    display_phone_number = "+971564343999"
                    phone_number_id = "518094511384485"
                }
                contacts = @(@{
                    profile = @{ name = "Test User" }
                    wa_id = "971501234567"
                })
                messages = @(@{
                    from = "971501234567"
                    id = "test_msg_$(Get-Date -Format 'yyyyMMddHHmmss')"
                    timestamp = [int][double]::Parse((Get-Date -UFormat %s))
                    text = @{ body = "TEST: WhatsApp webhook is working!" }
                    type = "text"
                })
            }
            field = "messages"
        })
    })
} | ConvertTo-Json -Depth 10

$testResult = Invoke-RestMethod -Uri "https://ai.dubaifmc.com/api/webhooks/meta" -Method POST -Body $testPayload -ContentType "application/json"
Write-Host "Webhook test result: $testResult"
