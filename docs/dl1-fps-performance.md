# DL1 FPS performance checks

## Запуск

```powershell
npm run perf:dl1 --workspace @wos/web
```

По умолчанию тест прогоняет текущий seed `DL1` 8 секунд на профиль. Длительность можно поменять:

```powershell
$env:DL1_PERF_DURATION_MS=15000
npm run perf:dl1 --workspace @wos/web
```

Отчёт пишется в Playwright artifact `dl1-fps-report.json` внутри `apps/web/test-results/...`.

## Что измеряется

- `averageFps` и `p50Fps`: общий уровень плавности во время drag/zoom по canvas.
- `p95FrameMs`: важнее среднего FPS. Для 60 FPS кадр должен быть около `16.7ms`; `33ms` уже ближе к 30 FPS.
- `worstFrameMs`, `droppedFramesOver50Ms`, `droppedFramesOver100Ms`: видимые фризы.
- `longTaskCount` и `longTaskTotalMs`: блокировки main thread дольше 50ms.
- `memory`: JS heap, если Chromium отдал `performance.memory`.

## Профили слабых ПК

Тест использует Chrome DevTools Protocol `Emulation.setCPUThrottlingRate`:

- `native-desktop`: текущая машина.
- `weak-laptop-cpu-4x`: CPU замедлен в 4 раза, viewport `1366x768`.
- `low-end-cpu-6x`: CPU замедлен в 6 раз, viewport `1280x720`.

Это приближение к слабым ПК, а не полный hardware benchmark: GPU, драйверы, память и thermal throttling так не эмулируются. Для решения "можно ли отдавать пользователям" смотрим на p95/worst frame на реальном слабом ноутбуке и сравниваем с этими профилями.

## Практические бюджеты

Начальная планка для DL1:

- desktop: `p95FrameMs <= 25`, `droppedFramesOver100Ms = 0`;
- weak-laptop-cpu-4x: `p95FrameMs <= 50`, `droppedFramesOver100Ms <= 2`;
- low-end-cpu-6x: report-only, нужен для тренда и поиска регрессий.

После 3-5 локальных прогонов лучше зафиксировать медианные значения в отдельном perf budget, чтобы тест начал ловить регрессии.
