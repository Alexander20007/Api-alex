import 'dotenv/config';
import { supabase } from './src/utils/supabase.js';

const { data, error } = await supabase
  .from('providers')
  .update({ enabled: true })
  .eq('name', 'vidsrc')
  .select();

if (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}

console.log(`✅ ${data.length} provider(s) atualizado(s)`);

await new Promise((r) => setTimeout(r, 500));

const { data: todos } = await supabase
  .from('providers')
  .select('name, priority, enabled')
  .order('priority');
console.table(todos);
