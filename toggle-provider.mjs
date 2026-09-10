import 'dotenv/config';
import { supabase } from './src/utils/supabase.js';

const name = process.argv[2];
const enabled = process.argv[3] === 'true';

if (!name) {
  console.log('Uso: node toggle-provider.mjs <nome> <true|false>');
  console.log('Exemplo: node toggle-provider.mjs vidsrc false');
  process.exit(1);
}

const { data, error } = await supabase
  .from('providers')
  .update({ enabled })
  .eq('name', name)
  .select();

if (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}

if (data.length === 0) {
  console.error(`❌ Provider "${name}" não encontrado`);
  process.exit(1);
}

console.log(`✅ ${name} → enabled=${enabled}`);

const { data: todos } = await supabase
  .from('providers')
  .select('name, priority, enabled')
  .order('priority');
console.table(todos);
