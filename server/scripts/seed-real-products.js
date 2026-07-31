// One-off/rerunnable seed script that creates real product catalog rows
// from the real product photography in public/assets/img/. Run with:
//   node server/scripts/seed-real-products.js
//
// IMPORTANT: prices/stock below are PLACEHOLDER values (not sourced from
// any real price list) - the admin must review and correct them via the
// admin panel (admin/products.html) before the store goes live. Everything
// else (names, categories, image files) reflects the real product photos.
//
// Safe to re-run: skips any product whose slug already exists instead of
// creating duplicates.
import 'dotenv/config';
import { supabaseAdmin } from '../src/lib/supabaseAdmin.js';
import { slugify } from '../src/lib/slugify.js';

const CATEGORY_SLUGS = { bot: 'sua-bot', tuoi: 'sua-tuoi' };

const PRODUCTS = [
  {
    name: 'Nutifood GrowPLUS+ Đỏ 780g (6-12 tháng)',
    category: 'bot',
    brand: 'Nutifood',
    base_price: 250000,
    short_description: 'Dinh dưỡng hiệu quả cho trẻ suy dinh dưỡng, thấp còi, 6-12 tháng tuổi.',
    images: ['nutifood-growplus-do-780g.jpg'],
    variants: [{ name: 'Lon 780g', sku: 'NTF-GPDO-780', price: 250000, stock_quantity: 40 }],
  },
  {
    name: 'Nutifood GrowPLUS+ Đỏ 850g (1 tuổi trở lên)',
    category: 'bot',
    brand: 'Nutifood',
    base_price: 270000,
    short_description: 'Sản phẩm dinh dưỡng cho trẻ suy dinh dưỡng, thấp còi, hỗ trợ tăng cân, tăng chiều cao.',
    images: ['nutifood-growplus-do-850g.jpg'],
    variants: [{ name: 'Lon 850g', sku: 'NTF-GPDO-850', price: 270000, stock_quantity: 40 }],
  },
  {
    name: 'Nutifood GrowPLUS+ Colostrum 800g (0-12 tháng)',
    category: 'bot',
    brand: 'Nutifood',
    base_price: 320000,
    short_description: '100% sữa non 24h từ Mỹ, hỗ trợ hệ miễn dịch và tiêu hoá cho bé 0-12 tháng.',
    images: ['nutifood-growplus-colostrum-800g.jpg'],
    variants: [{ name: 'Lon 800g', sku: 'NTF-GPCOL-800', price: 320000, stock_quantity: 35 }],
  },
  {
    name: 'Nutifood GrowPLUS+ Colostrum 850g (1 tuổi trở lên)',
    category: 'bot',
    brand: 'Nutifood',
    base_price: 340000,
    short_description: '100% sữa non 24h từ Mỹ, hỗ trợ bé phát triển chiều cao và trí não.',
    images: ['nutifood-growplus-colostrum-850g.jpg'],
    variants: [{ name: 'Lon 850g', sku: 'NTF-GPCOL-850', price: 340000, stock_quantity: 35 }],
  },
  {
    name: 'Friso Gold 4 850g (2-6 tuổi)',
    category: 'bot',
    brand: 'Friso',
    base_price: 550000,
    short_description: 'Công thức dinh dưỡng nhập khẩu Hà Lan, chứa GOS & Nucleotides, cho trẻ 2-6 tuổi.',
    images: ['friso-gold-4-850g.jpg'],
    variants: [{ name: 'Lon 850g', sku: 'FRISO-GOLD4-850', price: 550000, stock_quantity: 25 }],
  },
  {
    name: 'Anlene Bonemax Hương Vani 800g',
    category: 'bot',
    brand: 'Anlene',
    base_price: 320000,
    short_description: 'Sữa bột dinh dưỡng cho người từ 30 tuổi trở lên, hỗ trợ xương khớp chắc khoẻ.',
    images: ['anlene-bonemax-vani-800g.jpg'],
    variants: [{ name: 'Hộp 800g', sku: 'ANLENE-BM-VANI-800', price: 320000, stock_quantity: 30 }],
  },
  {
    name: 'PediaSure Pepti Gro Hương Vani (lốc 4 hộp)',
    category: 'bot',
    brand: 'Abbott',
    base_price: 150000,
    short_description: 'Hệ dưỡng chất Pepti Gro giúp trẻ 1-10 tuổi tăng cường sức đề kháng, tăng cân, cao lớn.',
    images: ['pediasure-peptigro-vani.jpg'],
    variants: [{ name: 'Lốc 4 hộp x 180ml', sku: 'ABBOTT-PDS-VANI-4', price: 150000, stock_quantity: 30 }],
  },
  {
    name: 'Vinamilk Optimum Gold (lốc 4 hộp)',
    category: 'tuoi',
    brand: 'Vinamilk',
    base_price: 45000,
    short_description: 'Sữa dinh dưỡng Optimum Gold với 6 HMO, hỗ trợ phát triển toàn diện cho bé.',
    images: ['vinamilk-optimum-gold-1.jpg', 'vinamilk-optimum-gold-2.jpg'],
    variants: [{ name: 'Lốc 4 hộp x 180ml', sku: 'VNM-OPT-GOLD-4', price: 45000, stock_quantity: 60 }],
  },
  {
    name: 'Vinamilk ADM (lốc 4 hộp)',
    category: 'tuoi',
    brand: 'Vinamilk',
    base_price: 40000,
    short_description: 'Sữa dinh dưỡng ít đường, bổ sung DHA, Canxi, Vitamin A, D3 cho bé.',
    images: ['vinamilk-adm-1.jpg', 'vinamilk-adm-2.jpg'],
    variants: [{ name: 'Lốc 4 hộp x 110ml', sku: 'VNM-ADM-4', price: 40000, stock_quantity: 60 }],
  },
  {
    name: 'Nestlé Milo Sữa Lúa Mạch 110ml (lốc 4 hộp)',
    category: 'tuoi',
    brand: 'Nestlé',
    base_price: 35000,
    short_description: 'Thức uống lúa mạch năng lượng, đã được chứng minh khoa học bền bỉ hơn.',
    images: ['milo-lua-mach-110ml.jpg'],
    variants: [{ name: 'Lốc 4 hộp x 110ml', sku: 'MILO-LM-110-4', price: 35000, stock_quantity: 50 }],
  },
  {
    name: 'Nestlé Milo Sữa Lúa Mạch 180ml (lốc 4 hộp)',
    category: 'tuoi',
    brand: 'Nestlé',
    base_price: 42000,
    short_description: 'Thức uống lúa mạch năng lượng, đã được chứng minh khoa học bền bỉ hơn.',
    images: ['milo-lua-mach-180ml.jpg'],
    variants: [{ name: 'Lốc 4 hộp x 180ml', sku: 'MILO-LM-180-4', price: 42000, stock_quantity: 50 }],
  },
  {
    name: 'Yomost Sữa Chua Uống Hương Cam (lốc 4 hộp)',
    category: 'tuoi',
    brand: 'Yomost',
    base_price: 38000,
    short_description: 'Sữa chua uống tiệt trùng hương cam, vị chua thanh mát.',
    images: ['yomost-cam.jpg'],
    variants: [{ name: 'Lốc 4 hộp', sku: 'YOMOST-CAM-4', price: 38000, stock_quantity: 45 }],
  },
  {
    name: 'Yomost Sữa Chua Uống Hương Dâu (lốc 4 hộp)',
    category: 'tuoi',
    brand: 'Yomost',
    base_price: 38000,
    short_description: 'Sữa chua uống tiệt trùng hương dâu, vị chua thanh mát.',
    images: ['yomost-dau.jpg'],
    variants: [{ name: 'Lốc 4 hộp', sku: 'YOMOST-DAU-4', price: 38000, stock_quantity: 45 }],
  },
  {
    name: 'Kun Sữa Trái Cây Có Thạch Hương Xoài 170ml (lốc 4 hộp)',
    category: 'tuoi',
    brand: 'Kun',
    base_price: 40000,
    short_description: 'Thức uống dinh dưỡng sữa trái cây hương xoài kèm thạch, bé thích mê.',
    images: ['kun-thach-xoai.jpg'],
    variants: [{ name: 'Lốc 4 hộp x 170ml', sku: 'KUN-XOAI-THACH-4', price: 40000, stock_quantity: 45 }],
  },
  {
    name: 'Kun Sữa Chua Uống Thạch Hương Dâu Kem 170ml (lốc 4 hộp)',
    category: 'tuoi',
    brand: 'Kun',
    base_price: 40000,
    short_description: 'Sữa chua uống tiệt trùng hương dâu kem kèm thạch.',
    images: ['kun-suachua-thach-dau.jpg'],
    variants: [{ name: 'Lốc 4 hộp x 170ml', sku: 'KUN-DAUKEM-THACH-4', price: 40000, stock_quantity: 45 }],
  },
  {
    name: 'Kun Sữa Lúa Mạch Sô Cô La (lốc 4 hộp)',
    category: 'tuoi',
    brand: 'Kun',
    base_price: 42000,
    short_description: 'Thức uống sữa lúa mạch sô cô la, hỗ trợ tăng chiều cao cho bé.',
    images: ['kun-luamach-socola-1.jpg', 'kun-luamach-socola-2.jpg'],
    variants: [{ name: 'Lốc 4 hộp', sku: 'KUN-LM-SOCOLA-4', price: 42000, stock_quantity: 45 }],
  },
];

async function main() {
  const { data: categories } = await supabaseAdmin.from('categories').select('id, slug');
  const categoryIdBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  let created = 0;
  let skipped = 0;

  for (const item of PRODUCTS) {
    const slug = slugify(item.name);
    const { data: existing } = await supabaseAdmin.from('products').select('id').eq('slug', slug).maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .insert({
        name: item.name,
        slug,
        brand: item.brand,
        category_id: categoryIdBySlug[CATEGORY_SLUGS[item.category]] || null,
        base_price: item.base_price,
        short_description: item.short_description,
        is_active: true,
      })
      .select()
      .single();

    if (productError) {
      console.error(`Loi khi tao san pham "${item.name}":`, productError.message);
      continue;
    }

    for (const variant of item.variants) {
      await supabaseAdmin.from('product_variants').insert({ product_id: product.id, ...variant });
    }

    for (const [index, filename] of item.images.entries()) {
      await supabaseAdmin.from('product_images').insert({
        product_id: product.id,
        url: `./assets/img/${filename}`,
        alt_text: item.name,
        sort_order: index,
        is_primary: index === 0,
      });
    }

    created += 1;
    console.log(`Da tao: ${item.name}`);
  }

  console.log(`\nHoan tat: ${created} san pham moi, ${skipped} san pham da ton tai (bo qua).`);
}

main();
