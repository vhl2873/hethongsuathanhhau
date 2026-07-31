import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { AppError } from '../lib/AppError.js';
import { isValidEmail, validateContactInput } from '../lib/validators.js';

export const contactRouter = Router();

contactRouter.post('/contact', async (req, res, next) => {
  try {
    const errors = validateContactInput(req.body);
    if (errors.length) throw new AppError('VALIDATION_ERROR', errors[0], 400, { errors });

    const { name, email, phone, subject, message } = req.body;
    const { error } = await supabaseAdmin
      .from('contacts')
      .insert({ name: name.trim(), email: email.trim(), phone: phone?.trim() || null, subject: subject?.trim() || null, message: message.trim() });

    if (error) throw new AppError('CONTACT_SUBMIT_FAILED', 'Không gửi được liên hệ, vui lòng thử lại.', 500);
    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

contactRouter.post('/newsletter', async (req, res, next) => {
  try {
    const email = req.body.email;
    if (!isValidEmail(email)) throw new AppError('VALIDATION_ERROR', 'Email không hợp lệ.', 400);

    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .upsert({ email: email.trim(), is_active: true }, { onConflict: 'email' });

    if (error) throw new AppError('NEWSLETTER_SUBSCRIBE_FAILED', 'Không đăng ký được, vui lòng thử lại.', 500);
    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
