// Bootstrap only: env loading, Express app init, middleware, route mounting,
// error handler. No business logic lives here - see routes/ and services/.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { supabaseAdmin } from './lib/supabaseAdmin.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { categoriesRouter } from './routes/categories.js';
import { bannersRouter } from './routes/banners.js';
import { settingsRouter } from './routes/settings.js';
import { couponsRouter } from './routes/coupons.js';
import { productsRouter } from './routes/products.js';
import { checkoutRouter } from './routes/checkout.js';
import { cartRouter } from './routes/cart.js';
import { authRouter } from './routes/auth.js';
import { ordersRouter } from './routes/orders.js';
import { postsRouter } from './routes/posts.js';
import { contactRouter } from './routes/contact.js';
import { adminDashboardRouter } from './routes/admin/dashboard.js';
import { adminCategoriesRouter } from './routes/admin/categories.js';
import { adminProductsRouter } from './routes/admin/products.js';
import { adminOrdersRouter } from './routes/admin/orders.js';
import { adminCustomersRouter } from './routes/admin/customers.js';
import { adminBannersRouter } from './routes/admin/banners.js';
import { adminCouponsRouter } from './routes/admin/coupons.js';
import { adminShippingPaymentRouter } from './routes/admin/shipping-payment.js';
import { adminReviewsRouter } from './routes/admin/reviews.js';
import { adminContactsRouter } from './routes/admin/contacts.js';
import { adminNewsletterRouter } from './routes/admin/newsletter.js';
import { adminSettingsRouter } from './routes/admin/settings.js';
import { adminContentRouter } from './routes/admin/content.js';
import { adminStorageRouter } from './routes/admin/storage.js';

const PORT = process.env.PORT || 3000;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

// Keeps the handle_new_user() trigger's admin-promotion email in sync with
// the env var on every boot - see server/supabase/schema.sql for why this
// can't be passed as a per-connection Postgres setting instead.
async function syncInitialAdminEmail() {
  const email = process.env.SUPABASE_INITIAL_ADMIN_EMAIL || '';
  const { error } = await supabaseAdmin
    .from('app_settings')
    .upsert({ key: 'initial_admin_email', value: email, updated_at: new Date().toISOString() });
  if (error) {
    console.error('Không thể đồng bộ initial_admin_email:', error.message);
  }
}

const app = express();

app.use(cors({ origin: CORS_ORIGINS.length ? CORS_ORIGINS : true }));
app.use(express.json());

app.use('/api/categories', categoriesRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/products', productsRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/cart', cartRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/posts', postsRouter);
app.use('/api', contactRouter);
app.use('/api/admin/dashboard', adminDashboardRouter);
app.use('/api/admin/categories', adminCategoriesRouter);
app.use('/api/admin/products', adminProductsRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/admin/customers', adminCustomersRouter);
app.use('/api/admin/banners', adminBannersRouter);
app.use('/api/admin/coupons', adminCouponsRouter);
app.use('/api/admin', adminShippingPaymentRouter);
app.use('/api/admin/reviews', adminReviewsRouter);
app.use('/api/admin/contacts', adminContactsRouter);
app.use('/api/admin/newsletter', adminNewsletterRouter);
app.use('/api/admin/settings', adminSettingsRouter);
app.use('/api/admin/content', adminContentRouter);
app.use('/api/admin/storage', adminStorageRouter);

app.use(notFoundHandler);
app.use(errorHandler);

await syncInitialAdminEmail();

app.listen(PORT, () => {
  console.log(`Server dang chay tai http://localhost:${PORT}`);
});
