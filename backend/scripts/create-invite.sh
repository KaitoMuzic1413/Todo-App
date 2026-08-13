#!/bin/bash
if [ "$#" -lt 1 ]; then
    echo "Usage: ./scripts/create-invite.sh <ADMIN_ID> [CODE] [EXPIRES_DAYS]"
    exit 1
fi
ADMIN_ID=$1
CODE=${2:-$(uuidgen | tr '[:upper:]' '[:lower:]' | cut -c1-12)}
INPUT_EXPIRES=${3:-30}
if [ "$INPUT_EXPIRES" -eq 0 ]; then
    EXPIRES=36500
else
    EXPIRES=$INPUT_EXPIRES
fi
API_URL="https://todo-app-1112.onrender.com/api/premium/invite/create"
echo "Creating invite code: $CODE..."
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$ADMIN_ID\",\"code\":\"$CODE\",\"expiresInDays\":$EXPIRES}")
if echo "$RESPONSE" | grep -q '"invite"'; then
    echo -n "$CODE" > "${CODE}.key"
    echo "SUCCESS: Invite created and saved to ${CODE}.key"
else
    echo "FAILED: $RESPONSE"
fi
