-- Lets the home hero carousel (previously hardcoded HTML in index.html) be
-- managed entirely from admin/banners.html: adds the extra text fields a
-- hero slide needs beyond the simple "one image + one link" banner model
-- (eyebrow tag, heading is the existing `title`, paragraph, and a second
-- optional CTA button alongside the existing `link_url`/label pair).
alter table public.banners
  add column if not exists eyebrow text,
  add column if not exists subtitle text,
  add column if not exists cta_label text,
  add column if not exists secondary_cta_label text,
  add column if not exists secondary_cta_url text;
