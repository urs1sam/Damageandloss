<?php
require_once __DIR__ . '/config.php';

$id = $_GET['id'] ?? '';
$stmt = $pdo->prepare("SELECT * FROM damage_entries WHERE id = ?");
$stmt->execute([$id]);
$entry = $stmt->fetch();

if (!$entry) {
    die("Entry not found.");
}
?>
<!DOCTYPE html>
<html lang="<?= $lang ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report <?= htmlspecialchars($entry['id']) ?> - <?= t('appBrand') ?></title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
        @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
        }
    </style>
</head>
<body class="bg-slate-100 text-slate-900 font-sans py-8 px-4 min-h-screen flex flex-col items-center">
    <div class="w-full max-w-3xl bg-white border border-slate-300 rounded-2xl shadow-lg p-8 space-y-6 print:border-none print:shadow-none print:p-0">
        <!-- Report Header -->
        <div class="flex items-center justify-between border-b border-slate-200 pb-5">
            <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                    <img src="/assets/aistudio/1280px-Emblem_of_Nepal.svg_ee194173.webp" alt="Emblem of Nepal" class="w-full h-full object-contain">
                </div>
                <div>
                    <h2 class="text-xs font-bold uppercase tracking-wider text-slate-600"><?= t('govTitle') ?></h2>
                    <h1 class="text-lg font-bold text-slate-900"><?= t('appBrand') ?></h1>
                    <p class="text-xs text-slate-500"><?= t('neocTitle') ?></p>
                </div>
            </div>
            <div class="text-right font-mono text-xs text-slate-600">
                <div>Ref ID: <span class="font-bold text-slate-900"><?= htmlspecialchars($entry['id']) ?></span></div>
                <div>Date: <?= htmlspecialchars($entry['date']) ?></div>
            </div>
        </div>

        <!-- Incident & Location -->
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
            <div class="font-bold text-slate-900 text-base"><?= htmlspecialchars($entry['title']) ?></div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
                <div><strong>Province:</strong> <?= htmlspecialchars($entry['province']) ?></div>
                <div><strong>District:</strong> <?= htmlspecialchars($entry['district']) ?></div>
                <div><strong>Municipality:</strong> <?= htmlspecialchars($entry['municipality']) ?></div>
                <div><strong>Ward:</strong> <?= htmlspecialchars($entry['ward']) ?></div>
            </div>
        </div>

        <!-- Loss & Human Impact Table -->
        <div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 border-b border-slate-200">
                Sector Damage & Financial Valuation Summary
            </div>
            <table class="w-full text-left text-sm border-collapse">
                <tbody class="divide-y divide-slate-100">
                    <tr>
                        <td class="py-3 px-4 font-medium text-slate-600">Sector & Standard</td>
                        <td class="py-3 px-4 text-slate-900 font-semibold"><?= htmlspecialchars($entry['sector']) ?> · <?= htmlspecialchars($entry['standard_name']) ?></td>
                    </tr>
                    <tr>
                        <td class="py-3 px-4 font-medium text-slate-600">Severity & Quantity</td>
                        <td class="py-3 px-4 font-mono text-slate-900"><?= htmlspecialchars($entry['severity']) ?> (<?= number_format($entry['qty']) ?> <?= htmlspecialchars($entry['unit']) ?>)</td>
                    </tr>
                    <tr>
                        <td class="py-3 px-4 font-medium text-slate-600">Direct Financial Loss</td>
                        <td class="py-3 px-4 font-mono font-bold text-red-700 text-base">Rs. <?= number_format($entry['loss_npr'], 0, '.', ',') ?></td>
                    </tr>
                    <tr>
                        <td class="py-3 px-4 font-medium text-slate-600">Human Casualties</td>
                        <td class="py-3 px-4 font-mono text-slate-900">Deaths: <?= $entry['deaths'] ?> · Missing: <?= $entry['missing'] ?> · Injured: <?= $entry['injured'] ?></td>
                    </tr>
                    <tr>
                        <td class="py-3 px-4 font-medium text-slate-600">Displacement Impact</td>
                        <td class="py-3 px-4 font-mono text-slate-900">Affected HH: <?= $entry['affected_hh'] ?> · Fully Displaced: <?= $entry['fully_displaced'] ?></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Officer Sign-off -->
        <div class="flex items-center justify-between pt-6 border-t border-slate-200 text-xs text-slate-600">
            <div>
                <div><strong>Reporting Officer:</strong> <?= htmlspecialchars($entry['officer']) ?></div>
                <div><strong>Contact:</strong> <?= htmlspecialchars($entry['contact']) ?></div>
            </div>
            <div class="text-right">
                <div class="font-bold text-slate-900">Official Verification</div>
                <div class="text-emerald-700 font-semibold mt-1"><?= htmlspecialchars($entry['verification']) ?></div>
            </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-between pt-4 no-print">
            <a href="index.php" class="text-xs font-medium text-blue-700 hover:text-blue-800">← Back to Dashboard</a>
            <button onclick="window.print()" class="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs">
                Print Official Report
            </button>
        </div>
    </div>
</body>
</html>
