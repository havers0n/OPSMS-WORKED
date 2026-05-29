-- Add category column to products table
alter table products
  add column category text null
    check (category in ('Палатки','Стулья','Мангалы','Столы','Бустеры','Контейнеры'));
