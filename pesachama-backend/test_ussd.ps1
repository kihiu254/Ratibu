$baseUrl = "https://lffmntkpimeothqsxblv.supabase.co/functions/v1/ussd-handler"

function Test-USSD {
    param (
        [string]$phoneNumber,
        [string]$text
    )

    $body = "phoneNumber=$phoneNumber&text=$text&sessionId=12345&serviceCode=*123#"
    
    try {
        $response = Invoke-RestMethod -Uri $baseUrl -Method Post -Body $body -ContentType "text/plain"
        Write-Host "Request: Text='$text'" -ForegroundColor Cyan
        Write-Host "Response: $response" -ForegroundColor Green
        Write-Host "------------------------------------------------"
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host "Response Body: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host "Testing USSD Handler..." -ForegroundColor Yellow

# 1. Main Menu
Test-USSD -phoneNumber "254712345678" -text ""

# 2. Check Balance (Mock User)
Test-USSD -phoneNumber "254712345678" -text "1"

# 3. Contribute Menu
Test-USSD -phoneNumber "254712345678" -text "2"

# 4. Contribute Amount (Mock)
Test-USSD -phoneNumber "254712345678" -text "2*100"

# 5. Meeting Status
Test-USSD -phoneNumber "254712345678" -text "4"

# 6. My Account
Test-USSD -phoneNumber "254712345678" -text "5"
