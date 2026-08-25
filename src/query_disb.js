import { createClient } from '@supabase/supabase-js';

const url = 'https://zdsbtfvhxymansgocznp.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkc2J0ZnZoeHltYW5zZ29jem5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQzMzI0OSwiZXhwIjoyMDk1MDA5MjQ5fQ.3a6ySL6EAw7CVXF-TXo-GRVqPFwduS0juuZeR8s2msc';

const client = createClient(url, key);

async function run() {
  const { data: disbursements, error: err } = await client
    .from('disbursements')
    .select('*')
    .eq('contract_id', 'CT1-2500012');

  if (err) {
    console.error('Disbursements error:', err);
  } else {
    console.log('Disbursements for CT1-2500012:');
    console.log(disbursements);
  }
}

run();
