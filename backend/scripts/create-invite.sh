#!/bin/bash
if [ "$#" -lt 1 ]; then
    echo "Usage: ./scripts/create-invite.sh <ADMIN_ID> [CODE] [EXPIRES_DAYS]"
    exit 1
fi

ADMIN_ID=$1
CODE=${2:-"vip"}
INPUT_EXPIRES=${3:-0}
EXPIRES=$((INPUT_EXPIRES == 0 ? 36500 : INPUT_EXPIRES))

if [ "$NODE_ENV" = "production" ]; then
    API_URL="https://todo-app-1112.onrender.com/api/premium/invite/create"
else
    API_URL="http://localhost:5001/api/premium/invite/create"
fi

echo "Creating invite code: $CODE using $API_URL..."
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$ADMIN_ID\",\"code\":\"$CODE\",\"expiresInDays\":$EXPIRES}")

if echo "$RESPONSE" | grep -q '"invite"'; then
    echo -n "$CODE" > "${CODE}.key"
    echo "SUCCESS: Invite created and saved to ${CODE}.key"
else
    echo "FAILED: $RESPONSE"
fi
