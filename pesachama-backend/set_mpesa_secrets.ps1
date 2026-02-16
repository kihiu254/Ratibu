# Set M-Pesa Secrets for Supabase Edge Functions from .env file

Write-Output "Reading secrets from .env file..."

# Function to parse .env file
function Get-EnvVar {
    param($Name)
    $val = Select-String -Path ".env" -Pattern "^$Name=(.*)" | ForEach-Object { $_.Matches.Groups[1].Value }
    return $val
}

$MPESA_CONSUMER_KEY = Get-EnvVar "MPESA_CONSUMER_KEY"
$MPESA_CONSUMER_SECRET = Get-EnvVar "MPESA_CONSUMER_SECRET"
$MPESA_PASSKEY = Get-EnvVar "MPESA_PASSKEY"
$MPESA_BUSINESS_SHORTCODE = Get-EnvVar "MPESA_BUSINESS_SHORTCODE"
$MPESA_ENV = Get-EnvVar "MPESA_ENV"
$MPESA_INITIATOR_PASSWORD = Get-EnvVar "MPESA_INITIATOR_PASSWORD"
$MPESA_SECURITY_CREDENTIAL = Get-EnvVar "MPESA_SECURITY_CREDENTIAL"

Write-Output "Setting Supabase Secrets..."

if ($MPESA_CONSUMER_KEY) { npx supabase secrets set MPESA_CONSUMER_KEY="$MPESA_CONSUMER_KEY" }
if ($MPESA_CONSUMER_SECRET) { npx supabase secrets set MPESA_CONSUMER_SECRET="$MPESA_CONSUMER_SECRET" }
if ($MPESA_PASSKEY) { npx supabase secrets set MPESA_PASSKEY="$MPESA_PASSKEY" }
if ($MPESA_BUSINESS_SHORTCODE) { npx supabase secrets set MPESA_BUSINESS_SHORTCODE="$MPESA_BUSINESS_SHORTCODE" }
if ($MPESA_ENV) { npx supabase secrets set MPESA_ENV="$MPESA_ENV" }
if ($MPESA_INITIATOR_PASSWORD) { npx supabase secrets set MPESA_INITIATOR_PASSWORD="$MPESA_INITIATOR_PASSWORD" }
if ($MPESA_SECURITY_CREDENTIAL) { npx supabase secrets set MPESA_SECURITY_CREDENTIAL="$MPESA_SECURITY_CREDENTIAL" }

Write-Output "Secrets set successfully from .env!"
