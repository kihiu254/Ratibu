$HandlerUrl = $env:USSD_HANDLER_URL
if ([string]::IsNullOrWhiteSpace($HandlerUrl)) {
    $HandlerUrl = "https://lffmntkpimeothqsxblv.supabase.co/functions/v1/ussd-handler"
}

$PhoneNumber = $env:USSD_PHONE_NUMBER
if ([string]::IsNullOrWhiteSpace($PhoneNumber)) {
    $PhoneNumber = "254712345678"
}

$ServiceCode = $env:USSD_SERVICE_CODE
if ([string]::IsNullOrWhiteSpace($ServiceCode)) {
    $ServiceCode = "*123#"
}

$SessionId = $env:USSD_SESSION_ID
if ([string]::IsNullOrWhiteSpace($SessionId)) {
    $SessionId = "12345"
}

function Invoke-UssdRequest {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Text
    )

    $body = @{
        phoneNumber = $PhoneNumber
        text = $Text
        sessionId = $SessionId
        serviceCode = $ServiceCode
    }

    try {
        $response = Invoke-RestMethod `
            -Uri $HandlerUrl `
            -Method Post `
            -Body $body `
            -ContentType "application/x-www-form-urlencoded"

        Write-Host "Request: text='$Text'" -ForegroundColor Cyan
        Write-Host "Response: $response" -ForegroundColor Green
        Write-Host "------------------------------------------------"
    }
    catch {
        Write-Host "Request: text='$Text'" -ForegroundColor Cyan
        Write-Host "Error: $_" -ForegroundColor Red
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            Write-Host "Response Body: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        Write-Host "------------------------------------------------"
    }
}

Write-Host "Testing USSD handler at $HandlerUrl" -ForegroundColor Yellow
Write-Host "Phone: $PhoneNumber" -ForegroundColor Yellow
Write-Host "Service code: $ServiceCode" -ForegroundColor Yellow
Write-Host "------------------------------------------------"

@(
    "",
    "1234",
    "1234*1",
    "1234*2",
    "1234*3",
    "1234*4",
    "1234*5",
    "1234*6",
    "1234*7",
    "1234*8",
    "1234*9"
) | ForEach-Object {
    Invoke-UssdRequest -Text $_
}
