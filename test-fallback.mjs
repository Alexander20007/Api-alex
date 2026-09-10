import 'dotenv/config';
import { supabase } from './src/utils/supabase.js';

// Desabilita vidsrc — ESPERA o retorno
const { error: updateError } = await supabase
  .from('providers')
  .update({ enabled: false })
  .eq('name', 'vidsrc')
  .select();   // ← .select() força o retorno dos dados atualizados

if (updateError) {
  console.error('❌ Erro ao desabilitar:', updateError.message);
  process.exit(1);
}
console.log('✅ vidsrc desabilitado');

// Espera um pouco para garantir a persistência
await new Promise((r) => setTimeout(r, 500));

// Mostra estado atual
const { data } = await supabase
  .from('providers')
  .select('name, priority, enabled')
  .order('priority');
console.table(data);
