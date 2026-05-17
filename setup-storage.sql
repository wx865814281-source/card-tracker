-- 在 Supabase SQL Editor 运行这段，创建图片存储桶
insert into storage.buckets (id, name, public)
values ('card-photos', 'card-photos', true);
