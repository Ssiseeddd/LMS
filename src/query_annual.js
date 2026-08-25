import { createClient } from '@supabase/supabase-js';

const url = 'https://zdsbtfvhxymansgocznp.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkc2J0ZnZoeHltYW5zZ29jem5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQzMzI0OSwiZXhwIjoyMDk1MDA5MjQ5fQ.3a6ySL6EAw7CVXF-TXo-GRVqPFwduS0juuZeR8s2msc';

const client = createClient(url, key);

async function run() {
  const { data: contracts, error: err } = await client
    .from('contracts')
    .select('*')
    .eq('payment_frequency', 'ANNUAL');

  if (err) {
    console.error('Contracts error:', err);
  } else {
    console.log('ANNUAL Contracts:');
    console.log(contracts.map(c => ({ id: c.id, customer_name: c.customer_name, start_date: c.start_date })));
  }
}

run();
