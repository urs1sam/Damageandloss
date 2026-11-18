<?php
require_once __DIR__ . '/config.php';

// Fetch summary metrics
$stmt = $pdo->query("SELECT 
    COUNT(*) as total_entries,
    SUM(loss_npr) as total_loss,
    SUM(affected_hh) as total_hh,
    SUM(deaths) as total_deaths,
    SUM(missing) as total_missing,
    SUM(injured) as total_injured,
    AVG(restoration_progress) as avg_progress
FROM damage_entries");
$kpi = $stmt->fetch();

// Fetch entries
$entriesStmt = $pdo->query("SELECT * FROM damage_entries ORDER BY created_at DESC LIMIT 50");
$entries = $entriesStmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="<?= $lang ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= t('appBrand') ?></title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="bg-[#f4f6f9] text-slate-900 font-sans antialiased min-h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-blue-900 flex items-center justify-center text-white font-bold text-sm shadow-xs border border-white/20">
                NP
            </div>
            <div>
                <h1 class="font-bold text-base text-slate-900"><?= t('appBrand') ?></h1>
                <p class="text-xs text-slate-500"><?= t('govTitle') ?></p>
            </div>
        </div>
        <div class="flex items-center gap-3">
            <div class="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
                <a href="?lang=en" class="px-2.5 py-1 rounded-md <?= $lang === 'en' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600' ?>">English</a>
                <a href="?lang=ne" class="px-2.5 py-1 rounded-md <?= $lang === 'ne' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600' ?>">नेपाली</a>
            </div>
            <a href="entry.php" class="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs">
                + <?= t('newEntry') ?>
            </a>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 space-y-6">
        <!-- DRRM Command Banner -->
        <section class="bg-gradient-to-r from-[#183059] via-[#234375] to-[#1c3359] rounded-2xl p-6 text-white shadow-md border border-[#26487e] flex items-center gap-5">
            <div class="bg-white p-2.5 rounded-xl shadow-lg shrink-0">
                <svg viewBox="0 0 36 36" class="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 28L12 16L18 22L24 14L32 28H4Z" fill="#DC2626" fillOpacity="0.3"/>
                    <path d="M8 28L14 18L18 22L22 16L28 28H8Z" fill="#2563EB"/>
                </svg>
            </div>
            <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-blue-200"><?= t('govTitle') ?></p>
                <h2 class="text-xl sm:text-2xl font-bold tracking-tight mt-0.5"><?= t('dashboardTitle') ?></h2>
                <p class="text-xs text-blue-100 mt-1"><?= t('neocTitle') ?></p>
            </div>
        </section>

        <!-- KPI Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div class="text-xs font-medium text-slate-500"><?= t('totalLoss') ?></div>
                <div class="text-2xl font-bold text-red-700 font-mono mt-1.5">
                    Rs. <?= number_format($kpi['total_loss'] ?? 0, 0, '.', ',') ?>
                </div>
                <div class="text-xs text-slate-400 mt-1"><?= $kpi['total_entries'] ?? 0 ?> registered loss events</div>
            </div>

            <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div class="text-xs font-medium text-slate-500"><?= t('affectedHH') ?></div>
                <div class="text-2xl font-bold text-slate-900 font-mono mt-1.5">
                    <?= number_format($kpi['total_hh'] ?? 0, 0, '.', ',') ?> HH
                </div>
                <div class="text-xs text-slate-400 mt-1">Total vulnerable families</div>
            </div>

            <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div class="text-xs font-medium text-slate-500"><?= t('casualties') ?></div>
                <div class="text-2xl font-bold text-amber-700 font-mono mt-1.5">
                    <?= ($kpi['total_deaths'] ?? 0) + ($kpi['total_missing'] ?? 0) + ($kpi['total_injured'] ?? 0) ?>
                </div>
                <div class="text-xs text-slate-400 mt-1">Deaths: <?= $kpi['total_deaths'] ?? 0 ?> · Injured: <?= $kpi['total_injured'] ?? 0 ?></div>
            </div>

            <div class="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div class="text-xs font-medium text-slate-500"><?= t('restoration') ?></div>
                <div class="text-2xl font-bold text-emerald-700 font-mono mt-1.5">
                    <?= round($kpi['avg_progress'] ?? 0) ?>%
                </div>
                <div class="text-xs text-slate-400 mt-1">Average physical recovery</div>
            </div>
        </div>

        <!-- Entries Register Table -->
        <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 class="font-bold text-sm text-slate-900">Field Loss & Damage Register</h3>
                <span class="text-xs font-mono text-slate-500"><?= count($entries) ?> records</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr class="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                            <th class="py-3 px-4">Date / ID</th>
                            <th class="py-3 px-4">Incident & Location</th>
                            <th class="py-3 px-4">Sector / Standard</th>
                            <th class="py-3 px-4 text-right">Loss (NPR)</th>
                            <th class="py-3 px-4 text-right"><?= t('actions') ?></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <?php if (empty($entries)): ?>
                            <tr>
                                <td colspan="5" class="py-12 text-center text-slate-500 text-sm">No disaster loss entries recorded yet in PHP database.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($entries as $e): ?>
                                <tr class="hover:bg-slate-50/75">
                                    <td class="py-3 px-4 font-mono text-xs">
                                        <div class="font-medium text-slate-900"><?= htmlspecialchars($e['date']) ?></div>
                                        <div class="text-slate-500 text-[11px]"><?= htmlspecialchars($e['id']) ?></div>
                                    </td>
                                    <td class="py-3 px-4">
                                        <div class="font-medium text-slate-900"><?= htmlspecialchars($e['title']) ?></div>
                                        <div class="text-xs text-slate-500"><?= htmlspecialchars($e['municipality']) ?> · Ward <?= htmlspecialchars($e['ward']) ?> (<?= htmlspecialchars($e['district']) ?>)</div>
                                    </td>
                                    <td class="py-3 px-4 text-xs text-slate-700">
                                        <span class="font-medium"><?= htmlspecialchars($e['sector']) ?></span> · <?= htmlspecialchars($e['standard_name']) ?>
                                    </td>
                                    <td class="py-3 px-4 text-right font-mono font-semibold text-red-700">
                                        Rs. <?= number_format($e['loss_npr'], 0, '.', ',') ?>
                                    </td>
                                    <td class="py-3 px-4 text-right">
                                        <a href="report.php?id=<?= urlencode($e['id']) ?>" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium">
                                            <?= t('viewReport') ?>
                                        </a>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </main>

    <footer class="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <?= t('appBrand') ?> · Powered by PHP 8.2 & SQLite / MySQL DRRM Engine
    </footer>
</body>
</html>
