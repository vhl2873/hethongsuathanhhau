import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.js';

const sourcePath = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!sourcePath) {
  throw new Error('Usage: node scripts/import-sql-export.js <export.sql>');
}

function splitValues(input) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "'") {
      current += char;
      if (quoted && input[index + 1] === "'") {
        current += input[index + 1];
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseLiteral(literal) {
  if (literal === 'NULL') return null;
  if (literal === 'TRUE') return true;
  if (literal === 'FALSE') return false;

  const quoted = literal.match(/^'([\s\S]*)'(?:::jsonb)?$/);
  if (quoted) {
    const value = quoted[1].replaceAll("''", "'");
    return literal.endsWith('::jsonb') ? JSON.parse(value) : value;
  }

  const number = Number(literal);
  return Number.isNaN(number) ? literal : number;
}

const sql = await readFile(sourcePath, 'utf8');
const inserts = /insert into public\."([^"]+)" \(([^)]+)\) values \(([\s\S]*?)\);/g;
const rowsByTable = new Map();

for (const match of sql.matchAll(inserts)) {
  const [, table, columnList, valueList] = match;
  const columns = [...columnList.matchAll(/"([^"]+)"/g)].map((column) => column[1]);
  const values = splitValues(valueList).map(parseLiteral);
  if (columns.length !== values.length) {
    throw new Error(`Invalid export row for ${table}: ${columns.length} columns, ${values.length} values`);
  }
  const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
  rowsByTable.set(table, [...(rowsByTable.get(table) || []), row]);
}

const importOrder = [
  'app_settings',
  'categories',
  'shipping_methods',
  'payment_methods',
  'products',
  'product_variants',
  'product_images',
  'posts',
  'contacts',
  'orders',
  'order_items',
  'order_status_history',
];

for (const table of importOrder) {
  const rows = rowsByTable.get(table) || [];
  if (!rows.length) continue;

  if (table === 'order_status_history') {
    for (const row of rows) row.changed_by = null;
  }

  if (dryRun) {
    console.log(`${table}: parsed ${rows.length}`);
    continue;
  }

  const conflictTarget = table === 'app_settings' ? 'key' : 'id';
  const { error } = await supabaseAdmin.from(table).upsert(rows, { onConflict: conflictTarget });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: imported ${rows.length}`);
}

console.log('Skipped user-bound tables: profiles, carts, cart_items');
