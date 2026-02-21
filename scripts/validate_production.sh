#!/bin/bash
###############################################################################
# Production Validation Script (Bash version)
# Validates deployment health and functionality
###############################################################################

set -e

# Configuration
BASE_URL="${1:-http://localhost:8000}"
PASSED=0
FAILED=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
success() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

failure() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

test_endpoint() {
    local name="$1"
    local endpoint="$2"
    local expected_status="${3:-200}"
    local method="${4:-GET}"
    
    ((TOTAL++))
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        success "$name - Status $response"
    else
        failure "$name - Expected $expected_status, got $response"
    fi
}

# Start validation
info "Starting production validation for $BASE_URL"
echo ""

# Test 1: Health Check
info "Test 1: Health Check Endpoint"
test_endpoint "Health Check" "/health" 200
echo ""

# Test 2: Root Endpoint
info "Test 2: Root API Endpoint"
test_endpoint "Root Endpoint" "/" 200
echo ""

# Test 3: Authentication Protection
info "Test 3: Authentication Protection"
test_endpoint "Protected Endpoint (No Auth)" "/api/v1/devices" 401
echo ""

# Test 4: Frontend Error Logging
info "Test 4: Frontend Error Logging"
((TOTAL++))
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/v1/frontend-errors" \
    -H "Content-Type: application/json" \
    -d '{"error_message":"Test","stack_trace":"Error: Test","url":"'$BASE_URL'/test","user_agent":"Bash/Validation"}' \
    2>/dev/null || echo "000")

if [ "$response" = "201" ]; then
    success "Frontend Error Logging - Status $response"
else
    failure "Frontend Error Logging - Expected 201, got $response"
fi
echo ""

# Test 5: Performance Endpoint
info "Test 5: Performance Debug Endpoint"
test_endpoint "Performance Metrics" "/debug/performance" 200
echo ""

# Summary
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "VALIDATION SUMMARY"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Total Tests:  $TOTAL"
echo -e "Passed:       ${GREEN}$PASSED${NC}"
echo -e "Failed:       $([ $FAILED -eq 0 ] && echo -e "${GREEN}$FAILED${NC}" || echo -e "${RED}$FAILED${NC}")"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All validation tests passed!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some validation tests failed${NC}"
    echo ""
    exit 1
fi
