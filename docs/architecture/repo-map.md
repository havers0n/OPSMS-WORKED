# Repo Map

Эта карта описывает не просто расположение файлов, а смысл каталогов и границы ответственности в репозитории.

Документ нужен как антидот против слепых выводов по именам:

- не каждый каталог уже наполнен реализацией;
- часть директорий зарезервирована под будущие слои;
- часть директорий является generated/runtime state и не должна использоваться как источник архитектурной правды.

## Как читать репо

### Где лежит архитектурная правда

- `apps/web` содержит пользовательский React-интерфейс и локальное UI-состояние.
- `apps/bff` содержит серверную HTTP-прослойку между web и Supabase.
- `apps/supabase` содержит авторитетную БД-схему, SQL-функции, RLS и SQL-тесты.
- `packages/domain` содержит канонические доменные типы, схемы и pure-логику.

### Где правда не живет

- `apps/web/src/entities/*/api` может читать сырые Supabase/BFF-ответы, но остальной UI не должен зависеть от DB row shape напрямую.
- `apps/web/src/entities/layout-version/model/editor-store.ts` хранит клиентский draft редактора, но это не серверный source of truth, пока draft не сохранен.
- `dist/`, `node_modules/`, `.turbo/`, `test-results/`, `.claude/worktrees/` не являются архитектурными источниками.

## Корень репозитория

### `apps/`

Продуктовые приложения и backend-узлы monorepo.

### `packages/`

Общие пакеты, которые переиспользуются между приложениями или резервируются под такую переиспользуемость.

### `docs/`

Архитектурная и организационная документация. Не исполняемый код, а договоренности о структуре системы.

### `.claude/`

Локальная служебная директория с worktree-снимками и конфигом внешнего агента. Это не часть продуктовой архитектуры; при анализе бизнес-кода ее лучше игнорировать.

### `node_modules/`

Корневые зависимости workspace. Generated.

### `.turbo/`

Локальный кэш и логи Turbo. Generated.

### Корневые файлы

#### `package.json`

Workspace-манифест monorepo. Определяет `apps/*` и `packages/*`, а также общие команды `build`, `lint`, `typecheck`, `test`.

#### `turbo.json`

Граф задач monorepo: что кэшируется, что зависит от родительских пакетов, какие артефакты считаются output.

#### `tsconfig.base.json`

Базовая TypeScript-конфигурация и alias-слой. Важно, что `@wos/domain` резолвится в исходники `packages/domain`, а `@/*` — в `apps/web/src/*`.

#### `eslint.config.mjs`

Глобальная линт-конфигурация с enforcement архитектурных границ фронтенда. Это не просто стиль: файл фиксирует допустимые направления импортов между `app/pages/widgets/features/entities/shared`.

#### `.env.example`

Шаблон переменных окружения. Не источник логики.

## `apps/web`

Пользовательское UI-приложение на React + Vite. Здесь живут маршруты, auth bootstrap, editor UX и BFF/Supabase-клиенты.

Важно: структура следует FSD-подобной схеме, но не в "чисто теоретическом" виде. Нужно ориентироваться на фактические обязанности каталогов, а не на идеальные шаблоны.

### `apps/web/src/app/`

Верхний слой приложения: bootstrap, глобальные provider'ы, router, shell-layout и UI-only store.

#### `bootstrap/`

Точка входа React-приложения. Монтирует `AppProvider` и `AppRouter`.

#### `providers/`

Глобальная инфраструктура runtime:

- `app-provider.tsx` композирует верхнеуровневые provider'ы;
- `auth-provider.tsx` поднимает Supabase session, получает workspace через BFF и сбрасывает локальные store при смене auth;
- `query-provider.tsx` поднимает TanStack Query.

#### `router/`

Маршрутизация и защита роутов. Здесь решается, какие страницы доступны только в authenticated workspace.

#### `layouts/`

Общий экранный каркас приложения, в который встраиваются route-level страницы.

#### `store/`

Глобальное UI-only состояние приложения:

- активный site/floor;
- состояние навигационного drawer.

Это не доменное состояние склада и не состояние layout draft.

#### `styles/`

Глобальные стили и токены интерфейса.

### `apps/web/src/pages/`

Route-level composition. Страницы собирают крупные виджеты и решают, какой экран показать для конкретного route.

#### `warehouse-setup/`

Главная реализованная продуктовая страница. Определяет состояние bootstrap/floor-selection/editor-ready и переключает экран между:

- bootstrap мастером;
- состоянием выбора site/floor;
- редактором склада.

#### `login/`

Страница входа и регистрации в workspace.

#### `products/`

Пока в основном каркас/заглушка под будущий модуль product master и location roles.

#### `operations/`

Пока в основном каркас/заглушка под operational readiness и дальнейшие execution flows.

### `apps/web/src/widgets/`

Крупные экранные блоки и screen-level composition. Это не route, но и не атомарные action-компоненты.

#### `app-shell/`

Навигационная оболочка приложения:

- левый drawer;
- top bar;
- layout-context для shell-поведения.

#### `warehouse/bootstrap/`

Онбординг/инициализация пустого инстанса:

- создание первого site;
- создание первого floor;
- открытие первого layout draft.

Это не "настройки", а обязательный bootstrap перед входом в редактор.

#### `warehouse/editor/`

Главный рабочий модуль V1.

Содержит:

- canvas-представление склада;
- tool rail;
- inspector;
- геометрию и spatial helpers;
- shape-компоненты для визуализации rack/cell/section.

Семантически это оболочка редактора, а не source of truth. Источник бизнес-правил — `@wos/domain`, источник persisted truth — BFF/Supabase.

##### `warehouse/editor/model/`

Локальные editor-facing модели и фикстуры, связанные с canvas/rendering. Основное состояние редактора фактически вынесено в `entities/layout-version/model`.

##### `warehouse/editor/lib/`

Чистые утилиты для геометрии, spacing и расчетов отрисовки.

##### `warehouse/editor/ui/`

Компоненты редактора: canvas, inspector, tool rail, shape-визуализация.

Примечание: фактический `RackInspector` сейчас живет здесь, а не в `widgets/rack-inspector`.

#### `rack-inspector/`

Сейчас это скорее зарезервированный каталог под вынос инспектора в отдельный виджет. Не считать его наполненным модулем, пока внутри нет реальной реализации.

### `apps/web/src/features/`

Action-level и workflow-slice логика. Здесь лежат user-triggered операции, формы и mutation hooks.

#### Реально используемые feature-группы

- `site-create/` и `floor-create/`: создание workspace-контекста склада;
- `layout-draft-save/`: создание draft и сохранение draft в persisted state;
- `layout-validate/`: валидация layout draft;
- `layout-publish/`: публикация layout version;
- `rack-create/`: мастер создания rack после placement на canvas;
- `rack-configure/`: вкладки конфигурации rack/face/spacing;
- `face-b-configure-mode/`: выбор стратегии для Face B (`mirror`, `copy`, `scratch`).

Практическое правило: `features/` реализуют действия пользователя, но не должны становиться местом для общего domain-model или для screen-level layout.

### `apps/web/src/entities/`

Entity-level слой и фронтовая граница между API-данными и UI.

#### `site/` и `floor/`

Чтение и маппинг warehouse context для выбора активной площадки и этажа.

#### `layout-version/`

Ключевой модуль фронтенда.

Здесь живет:

- чтение активного draft и published summary;
- editor store;
- selectors и editor types;
- тесты и фикстуры draft-состояния.

Семантически это "frontend representation of layout lifecycle", а не просто API-клиент к таблице `layout_versions`.

#### `rack/` и `cell/`

Entity-level API-мэппинг для пространственных сущностей layout.

### `apps/web/src/shared/`

Нижний слой фронтенда: базовая инфраструктура, которая не должна знать о product-specific слоях.

#### `api/supabase/`

Низкоуровневая работа с Supabase:

- клиент;
- auth helpers;
- query client;
- generated types.

Важно: generated Supabase types должны оставаться внутри API-границ, а не расползаться по всему UI.

#### `api/bff/`

HTTP-клиент к `apps/bff`, включая проброс bearer token из текущей Supabase session.

#### `config/`

Маршруты и env-конфиг фронтенда.

#### `lib/`

Общие утилиты без бизнес-семантики склада.

#### `ui/`

Базовые переиспользуемые UI-примитивы. Сейчас слой небольшой и не заменяет полноценный `packages/ui`.

### `apps/web/e2e/`

Playwright end-to-end сценарии. Это основной слой фронтенд-уверенности для пользовательских потоков, а не библиотека unit-компонентов.

### `apps/web/public/`

Статические ассеты Vite.

### `apps/web/.ladle/`

Песочница/изолированная среда для разработки тяжелых UI-состояний. Не production-код.

### `apps/web/dist/`

Собранный фронтенд-бандл. Generated.

### `apps/web/test-results/`

Артефакты e2e-запусков. Generated.

### `apps/web/node_modules/`, `apps/web/.turbo/`

Локальные зависимости и кэш/логи. Generated.

## `apps/bff`

Backend-for-frontend на Fastify. Его задача — дать web-приложению стабильный HTTP-контракт, скрыть детали auth/workspace resolution и централизовать доступ к Supabase RPC/таблицам.

Это не отдельный domain-backend с собственной бизнес-моделью; он скорее transport + anti-corruption слой между UI и Supabase.

### `apps/bff/src/server.ts`

Точка запуска HTTP-сервера.

### `apps/bff/src/app.ts`

Главная сборка Fastify-приложения:

- health/ready endpoints;
- auth-aware endpoints;
- site/floor/layout-draft/publish/save маршруты;
- error mapping;
- Supabase RPC orchestration.

Это основной файл поведения BFF.

### `apps/bff/src/auth.ts`

Валидация bearer token, чтение профиля и tenant membership, определение текущего workspace.

### `apps/bff/src/schemas.ts`

Zod-контракты входов и выходов BFF. Фиксирует внешний API BFF и связывает его с доменными схемами из `@wos/domain`.

### `apps/bff/src/mappers.ts`

Переход от Supabase row shape / RPC payload к доменным объектам, которые возвращаются наружу.

### `apps/bff/src/supabase.ts`

Фабрики Supabase-клиентов: anon и user-scoped.

### `apps/bff/src/env.ts`

Runtime-конфиг BFF.

### `apps/bff/src/errors.ts`

Единая модель API-ошибок и маппинг ошибок Supabase в HTTP-ответы.

### `apps/bff/src/*.test.ts`

Точечные тесты серверного слоя и контракта маршрутов.

### `apps/bff/node_modules/`, `apps/bff/.turbo/`

Локальные зависимости и логи. Generated.

## `apps/supabase`

Авторитетный слой хранения и серверной бизнес-логики на уровне БД. Если вопрос касается схемы, инвариантов publish lifecycle, RLS или SQL-функций, первичный ответ ищется здесь.

### `migrations/`

История изменения схемы и SQL-логики.

Семантически это:

- таблицы;
- helper functions;
- publish lifecycle;
- auth/RLS;
- tenancy model.

Порядок файлов важен: это фактическая эволюция схемы.

### `tests/sql/`

SQL и PowerShell-обвязка для database-level тестов. Здесь проверяются lifecycle и инварианты, которые нельзя надежно доказать только фронтендом.

### `functions/`

Резерв под Supabase Edge Functions. Сейчас каталог существует как слот, а не как насыщенный runtime-модуль.

### `snippets/`

Вспомогательные SQL/черновики/локальные заготовки. Не считать основным source of truth, пока поведение не зафиксировано миграцией.

### `seed.sql`

Начальный seed для локального окружения.

### `config.toml`

Конфигурация локального Supabase-проекта.

### `.branches/`, `.temp/`

Служебное состояние Supabase CLI. Generated/local-only.

### `.turbo/`

Логи Turbo для тестовых задач. Generated.

## `packages/domain`

Канонический domain package. Это место для стабильных типов, Zod-схем, enum'ов и pure-функций, которые не должны зависеть ни от React, ни от Supabase SDK, ни от Fastify.

Если возникает вопрос "как называется доменная сущность", "как валидируется draft", "как генерируются cell address", сначала смотреть сюда.

### `src/index.ts`

Публичный export surface доменного пакета.

### `src/layout/`

Главная доменная логика текущего V1:

- `rack`, `layout-version`, `layout-draft`, `cell`;
- генерация адресов/ячеек;
- валидация layout draft;
- фикстуры и unit-тесты.

Это pure domain, не UI и не DB adapter.

### `src/warehouse/`

Базовые доменные типы site/floor и setup state.

### `src/picking/`

Слот под picking-domain. Сейчас слой почти пустой, но зарезервирован под развитие execution semantics.

### `src/contracts/`

Срезы доменных контрактов верхнего уровня, например readiness.

### `src/enums/`

Общие перечисления домена, используемые несколькими модулями.

### `dist/`

Собранный output пакета. Generated.

### `node_modules/`, `.turbo/`

Локальные зависимости и build/test logs. Generated.

## `packages/ui`

Зарезервированный пакет под кросс-приложенческие UI-примитивы. Сейчас фактически placeholder; основная UI-база пока живет в `apps/web/src/shared/ui`.

Не стоит предполагать, что здесь уже находится реальный design system.

## `packages/config`

Зарезервированное место для общих конфигурационных пакетов monorepo.

### `eslint/`

Слот под переиспользуемую ESLint-конфигурацию.

### `tailwind/`

Слот под общую Tailwind-конфигурацию.

### `typescript/`

Слот под общую TypeScript-конфигурацию.

Примечание: на текущем этапе значимая часть конфигурации все еще живет в корневых `eslint.config.mjs` и `tsconfig.base.json`, поэтому `packages/config` нужно читать как "target location", а не как уже полностью наполненный пакет.

## `docs`

Документационный слой репозитория.

### `docs/architecture/`

Архитектурные baseline-документы и карты.

#### `architecture-baseline.md`

Фиксирует продуктовые и технические инварианты V1.

#### `supabase-schema-module-map.md`

Описывает, как домен раскладывается на DB/schema modules.

#### `frontend-folder-file-plan.md`

Описывает целевую структуру фронтенда. Это важно: документ описывает target state, а не обязательно текущее фактическое наполнение каждого каталога.

#### `repo-map.md`

Этот документ. Нужен как карта текущего репозитория и семантики директорий.

## Что считать generated и обычно игнорировать при анализе

- `node_modules/`
- `dist/`
- `test-results/`
- `.turbo/`
- `apps/supabase/.branches/`
- `apps/supabase/.temp/`
- `.claude/worktrees/`

## Практические правила для агента

1. Для бизнес-смысла и инвариантов сначала смотреть в `packages/domain` и `docs/architecture`.
2. Для persisted schema и серверных lifecycle-правил сначала смотреть в `apps/supabase/migrations`.
3. Для HTTP-контрактов web-приложения сначала смотреть в `apps/bff/src/app.ts` и `apps/bff/src/schemas.ts`.
4. Для UI-flow и client-side orchestration сначала смотреть в `apps/web/src/pages`, `widgets`, `features`, `entities`.
5. Не делать вывод "каталог реализован", если он существует, но фактически пуст или зарезервирован.
