async function test() {
  const spanRes = await fetch(`https://api.omium.ai/api/v1/executions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer omium_sWCytiFYSqhoyAl1qZGjnDNzgOHavxR0iOWbc-zaoNQ"
    },
    body: JSON.stringify({
      workflow_id: "123e4567-e89b-12d3-a456-426614174000",
      agent_id: "orchestrator",
      name: "test_run",
      type: "chain"
    })
  });
  const spanData = await spanRes.text();
  console.log(spanRes.status, spanData);
}
test();
