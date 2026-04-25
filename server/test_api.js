async function test() {
  try {
    const res = await fetch('http://localhost:3001/api/voters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-password': 'betfajjar2026'
      },
      body: JSON.stringify({
        first_name: 'Test',
        father_name: 'Manual',
        grand_name: 'Voter',
        family_name: 'Success',
        national_id: '999999',
        school: 'Local Test',
        markAsVoted: true
      })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Data:', data);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
