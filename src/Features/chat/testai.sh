curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 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" \
  -d '{
    "model": "gpt-4o-mini",
    "store": true,
    "messages": [
      {"role": "user", "content": "write a haiku about ai"}
    ]
  }'