<?php
require_once __DIR__ . '/config.php';

$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $id = 'LD-' . date('Y') . '-' . rand(100, 999);
    $ownerId = 'admin-php';
    $date = $_POST['date'] ?? date('Y-m-d');
    $province = $_POST['province'] ?? 'Bagmati Province';
    $district = $_POST['district'] ?? 'Kathmandu';
    $municipality = $_POST['municipality'] ?? 'Kathmandu Metropolitan City';
    $ward = $_POST['ward'] ?? '1';
    $tole = $_POST['tole'] ?? '';
    $hazard = $_POST['hazard'] ?? 'Flood';
    $title = $_POST['title'] ?? 'Monsoon Flood Disaster';
    $sector = $_POST['sector'] ?? 'Housing & Shelter';
    $standardName = $_POST['standard_name'] ?? 'Private Housing Fully Damaged';
    $severity = $_POST['severity'] ?? 'Severe';
    $unit = $_POST['unit'] ?? 'Houses';
    $qty = floatval($_POST['qty'] ?? 1);
    $lossNpr = floatval($_POST['loss_npr'] ?? 100000);
    $deaths = intval($_POST['deaths'] ?? 0);
    $missing = intval($_POST['missing'] ?? 0);
    $injured = intval($_POST['injured'] ?? 0);
    $affectedHH = intval($_POST['affected_hh'] ?? 1);
    $fullyDisplaced = intval($_POST['fully_displaced'] ?? 0);
    $tempDisplaced = intval($_POST['temp_displaced'] ?? 1);
    $affectedPop = intval($_POST['affected_pop'] ?? 5);
    $officer = $_POST['officer'] ?? 'DRRM Officer';
    $contact = $_POST['contact'] ?? '9800000000';
    $remarks = $_POST['remarks'] ?? '';

    try {
        $stmt = $pdo->prepare("INSERT INTO damage_entries (
            id, owner_id, date, province, district, municipality, ward, tole, hazard, title, sector,
            standard_name, severity, unit, qty, loss_npr, deaths, missing, injured, affected_hh,
            fully_displaced, temp_displaced, affected_pop, officer, contact, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        $stmt->execute([
            $id, $ownerId, $date, $province, $district, $municipality, $ward, $tole, $hazard, $title, $sector,
            $standardName, $severity, $unit, $qty, $lossNpr, $deaths, $missing, $injured, $affectedHH,
            $fullyDisplaced, $tempDisplaced, $affectedPop, $officer, $contact, $remarks
        ]);
        
        header('Location: index.php');
        exit;
    } catch (PDOException $e) {
        $error = "Failed to save entry: " . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="<?= $lang ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Field Entry - <?= t('appBrand') ?></title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body class="bg-[#f4f6f9] text-slate-900 font-sans antialiased min-h-screen flex flex-col">
    <header class="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
        <a href="index.php" class="text-xs font-semibold text-blue-700 hover:text-blue-800">← Back to Dashboard</a>
        <h1 class="font-bold text-sm text-slate-900"><?= t('newEntry') ?></h1>
    </header>

    <main class="flex-1 max-w-4xl w-full mx-auto px-6 py-8">
        <?php if ($error): ?>
            <div class="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm font-medium"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>

        <form method="POST" class="space-y-6">
            <!-- Block 1: Geographic Location (Blue Theme) -->
            <section class="bg-blue-50/30 border border-blue-200 rounded-xl p-5 shadow-xs space-y-4">
                <h3 class="font-bold text-sm text-blue-900 border-b border-blue-200 pb-2">1. Geographic Location & Address</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Province</label>
                        <input type="text" name="province" value="Bagmati Province" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">District</label>
                        <input type="text" name="district" value="Kathmandu" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Municipality</label>
                        <input type="text" name="municipality" value="Kathmandu Metropolitan City" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Ward No.</label>
                        <input type="text" name="ward" value="1" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Tole / Village</label>
                        <input type="text" name="tole" placeholder="e.g., Thamel Chowk" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    </div>
                </div>
            </section>

            <!-- Block 2: Incident & Human Casualties (Amber Theme) -->
            <section class="bg-amber-50/30 border border-amber-200 rounded-xl p-5 shadow-xs space-y-4">
                <h3 class="font-bold text-sm text-amber-900 border-b border-amber-200 pb-2">2. Incident Context & Human Casualties</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Incident Date</label>
                        <input type="date" name="date" value="<?= date('Y-m-d') ?>" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Hazard Type</label>
                        <select name="hazard" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                            <option value="Flood">Flood (बाढी)</option>
                            <option value="Landslide">Landslide (पहिरो)</option>
                            <option value="Earthquake">Earthquake (भूकम्प)</option>
                            <option value="Fire">Fire (आगलागी)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Incident Title</label>
                        <input type="text" name="title" value="Monsoon Cloudburst Flood" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Deaths</label>
                        <input type="number" name="deaths" value="0" min="0" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Missing</label>
                        <input type="number" name="missing" value="0" min="0" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Injured</label>
                        <input type="number" name="injured" value="0" min="0" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Affected HH</label>
                        <input type="number" name="affected_hh" value="12" min="0" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono">
                    </div>
                </div>
            </section>

            <!-- Block 3: Sector & Financial Loss (Emerald Theme) -->
            <section class="bg-emerald-50/30 border border-emerald-200 rounded-xl p-5 shadow-xs space-y-4">
                <h3 class="font-bold text-sm text-emerald-900 border-b border-emerald-200 pb-2">3. Sector Damage & Financial Loss</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Sector</label>
                        <select name="sector" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                            <option value="Housing & Shelter">Housing & Shelter</option>
                            <option value="Roads & Bridges">Roads & Bridges</option>
                            <option value="Agriculture & Livestock">Agriculture & Livestock</option>
                            <option value="Education">Education</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Damage Standard Name</label>
                        <input type="text" name="standard_name" value="Private Housing Fully Damaged (Grade 5)" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Estimated Financial Loss (NPR)</label>
                        <input type="number" name="loss_npr" value="1500000" min="0" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono">
                    </div>
                </div>
            </section>

            <!-- Block 4: Field Officer Sign-off (Slate Theme) -->
            <section class="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <h3 class="font-bold text-sm text-slate-900 border-b border-slate-200 pb-2">4. Field Assessment Verification</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Reporting Officer Name</label>
                        <input type="text" name="officer" value="Nibas Shrestha (DRRM Expert)" required class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                        <input type="text" name="contact" value="9841000000" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                    </div>
                </div>
            </section>

            <div class="flex justify-end gap-3">
                <a href="index.php" class="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</a>
                <button type="submit" class="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-xs">
                    <?= t('save') ?>
                </button>
            </div>
        </form>
    </main>
</body>
</html>
