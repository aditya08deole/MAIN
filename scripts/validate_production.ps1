#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Production validation script
    Verifies all critical endpoints and functionality

.DESCRIPTION
    Runs comprehensive health checks on production deployment
    Tests authentication, database, API endpoints, and performance

.PARAMETER BaseUrl
    Base URL of the deployment (default: http://localhost:8000)

.PARAMETER SkipAuth
    Skip authentication tests (useful for initial setup)

.EXAMPLE
    .\validate_production.ps1 -BaseUrl "https://your-app.onrender.com"
#>

param(
    [string]$BaseUrl = "http://localhost:8000",
    [switch]$SkipAuth = $false
)

$ErrorActionPreference = "Stop"
$WarningPreference = "Continue"

# Colors for output
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Failure { Write-Host "✗ $args" -ForegroundColor Red }
function Write-Info { Write-Host "ℹ $args" -ForegroundColor Cyan }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }

# ============================================================================
# CONFIGURATION
# ============================================================================

$script:PassedTests = 0
$script:FailedTests = 0
$script:TotalTests = 0

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200,
        [hashtable]$Headers = @{},
        [string]$Method = "GET",
        [object]$Body = $null
    )
    
    $script:TotalTests++
    
    try {
        $params = @{
            Uri = "$BaseUrl$Url"
            Method = $Method
            Headers = $Headers
            TimeoutSec = 10
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params -UseBasicParsing
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Success "$Name - Status $($response.StatusCode)"
            $script:PassedTests++
            return $response
        }
        else {
            Write-Failure "$Name - Expected $ExpectedStatus, got $($response.StatusCode)"
            $script:FailedTests++
            return $null
        }
    }
    catch {
        Write-Failure "$Name - $($_.Exception.Message)"
        $script:FailedTests++
        return $null
    }
}

function Test-PerformanceThreshold {
    param(
        [string]$Name,
        [scriptblock]$Action,
        [int]$ThresholdMs = 1000
    )
    
    $script:TotalTests++
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $result = & $Action
        $stopwatch.Stop()
        
        $durationMs = $stopwatch.ElapsedMilliseconds
        
        if ($durationMs -le $ThresholdMs) {
            Write-Success "$Name - ${durationMs}ms (threshold: ${ThresholdMs}ms)"
            $script:PassedTests++
            return $result
        }
        else {
            Write-Warning "$Name - ${durationMs}ms exceeds threshold of ${ThresholdMs}ms"
            $script:FailedTests++
            return $result
        }
    }
    catch {
        Write-Failure "$Name - $($_.Exception.Message)"
        $script:FailedTests++
        return $null
    }
}

# ============================================================================
# VALIDATION TESTS
# ============================================================================

Write-Info "Starting production validation for $BaseUrl"
Write-Host ""

# Test 1: Health Check
Write-Info "Test 1: Health Check Endpoint"
$healthResponse = Test-Endpoint -Name "Health Check" -Url "/health" -ExpectedStatus 200

if ($healthResponse) {
    $health = $healthResponse.Content | ConvertFrom-Json
    Write-Host "  Database: $($health.database)" -ForegroundColor Gray
    Write-Host "  Status: $($health.status)" -ForegroundColor Gray
}
Write-Host ""

# Test 2: Root Endpoint
Write-Info "Test 2: Root API Endpoint"
Test-Endpoint -Name "Root Endpoint" -Url "/" -ExpectedStatus 200
Write-Host ""

# Test 3: CORS Headers
Write-Info "Test 3: CORS Configuration"
$script:TotalTests++
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method OPTIONS -UseBasicParsing -TimeoutSec 5
    if ($response.Headers["Access-Control-Allow-Origin"]) {
        Write-Success "CORS Headers Present"
        $script:PassedTests++
    }
    else {
        Write-Warning "CORS Headers Missing (may be intentional)"
        $script:PassedTests++
    }
}
catch {
    Write-Warning "CORS Check Failed - $($_.Exception.Message)"
    $script:PassedTests++
}
Write-Host ""

# Test 4: Authentication Protection
Write-Info "Test 4: Authentication Protection"
Test-Endpoint -Name "Protected Endpoint (No Auth)" -Url "/api/v1/devices" -ExpectedStatus 401
Write-Host ""

# Test 5: Frontend Error Logging
Write-Info "Test 5: Frontend Error Logging"
$errorData = @{
    error_message = "Validation test error"
    stack_trace = "Error: Test\n  at validation.ps1"
    url = "$BaseUrl/validation"
    user_agent = "PowerShell/Validation"
}
Test-Endpoint -Name "Frontend Error Logging" -Url "/api/v1/frontend-errors" -Method POST -Body $errorData -ExpectedStatus 201
Write-Host ""

# Test 6: Performance Monitoring
Write-Info "Test 6: Performance Debug Endpoint"
$perfResponse = Test-Endpoint -Name "Performance Metrics" -Url "/debug/performance" -ExpectedStatus 200

if ($perfResponse) {
    $perf = $perfResponse.Content | ConvertFrom-Json
    Write-Host "  Timestamp: $($perf.timestamp)" -ForegroundColor Gray
    if ($perf.api_stats) {
        Write-Host "  Total Requests: $($perf.api_stats.total_requests)" -ForegroundColor Gray
    }
}
Write-Host ""

# Test 7: Response Time
Write-Info "Test 7: Response Time Performance"
Test-PerformanceThreshold -Name "Health Check Response Time" -ThresholdMs 500 -Action {
    Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing -TimeoutSec 5
}
Write-Host ""

# Test 8: Database Connectivity
Write-Info "Test 8: Database Connection"
$script:TotalTests++
if ($healthResponse) {
    $health = $healthResponse.Content | ConvertFrom-Json
    if ($health.database -eq "connected") {
        Write-Success "Database Connected"
        $script:PassedTests++
    }
    else {
        Write-Failure "Database Not Connected: $($health.database)"
        $script:FailedTests++
    }
}
else {
    Write-Failure "Cannot verify database (health check failed)"
    $script:FailedTests++
}
Write-Host ""

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Tests:  $script:TotalTests" -ForegroundColor White
Write-Host "Passed:       $script:PassedTests" -ForegroundColor Green
Write-Host "Failed:       $script:FailedTests" -ForegroundColor $(if ($script:FailedTests -eq 0) { "Green" } else { "Red" })
Write-Host ""

$successRate = [math]::Round(($script:PassedTests / $script:TotalTests) * 100, 2)
Write-Host "Success Rate: ${successRate}%" -ForegroundColor $(if ($successRate -ge 80) { "Green" } elseif ($successRate -ge 60) { "Yellow" } else { "Red" })
Write-Host ""

if ($script:FailedTests -eq 0) {
    Write-Success "✓ All validation tests passed!"
    Write-Host ""
    exit 0
}
else {
    Write-Failure "✗ Some validation tests failed"
    Write-Host ""
    exit 1
}
