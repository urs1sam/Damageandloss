<?php
/**
 * Nepal Loss & Damage Entry MIS - Configuration & Translations (PHP 8.2+)
 */

session_start();
error_reporting(E_ALL);
ini_set('display_errors', '1');

// Determine Language (en / ne)
$lang = isset($_GET['lang']) && $_GET['lang'] === 'ne' ? 'ne' : (isset($_SESSION['lang']) ? $_SESSION['lang'] : 'en');
$_SESSION['lang'] = $lang;

// Database Connection (PDO SQLite or MySQL)
$dbPath = __DIR__ . '/nepal_loss_damage_mis.sqlite';
try {
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Initialize Schema if not exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS damage_entries (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        date TEXT NOT NULL,
        province TEXT NOT NULL,
        district TEXT NOT NULL,
        municipality TEXT NOT NULL,
        ward TEXT NOT NULL,
        tole TEXT,
        hazard TEXT NOT NULL,
        title TEXT NOT NULL,
        sector TEXT NOT NULL,
        standard_name TEXT NOT NULL,
        severity TEXT NOT NULL,
        unit TEXT NOT NULL,
        qty REAL NOT NULL,
        loss_npr REAL NOT NULL,
        deaths INTEGER DEFAULT 0,
        missing INTEGER DEFAULT 0,
        injured INTEGER DEFAULT 0,
        affected_hh INTEGER DEFAULT 0,
        fully_displaced INTEGER DEFAULT 0,
        temp_displaced INTEGER DEFAULT 0,
        affected_pop INTEGER DEFAULT 0,
        officer TEXT,
        contact TEXT,
        verification TEXT DEFAULT 'Pending Review',
        priority TEXT DEFAULT 'High',
        remarks TEXT,
        restoration_stage TEXT DEFAULT 'Not Started',
        restoration_progress INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

// Bilingual Dictionary
$UI = [
    'en' => [
        'appBrand' => 'Nepal Loss & Damage Entry MIS',
        'govTitle' => 'Government of Nepal · Ministry of Home Affairs',
        'neocTitle' => 'National Emergency Operation Center (NEOC)',
        'dashboardTitle' => 'DRRM Risk Management & Loss Analytics Command Center',
        'totalLoss' => 'Total Direct Financial Loss',
        'affectedHH' => 'Affected Households',
        'casualties' => 'Human Casualties',
        'restoration' => 'Restoration Progress',
        'newEntry' => 'New Field Loss Entry',
        'province' => 'Province',
        'district' => 'District',
        'municipality' => 'Municipality / Rural Municipality',
        'ward' => 'Ward No.',
        'hazard' => 'Hazard / Disaster Type',
        'lossNpr' => 'Financial Loss (NPR)',
        'actions' => 'Actions',
        'viewReport' => 'Print Report',
        'save' => 'Save Entry',
    ],
    'ne' => [
        'appBrand' => 'नेपाल क्षति तथा नोक्सानी प्रविष्टि MIS',
        'govTitle' => 'नेपाल सरकार · गृह मन्त्रालय',
        'neocTitle' => 'राष्ट्रिय आपतकालीन कार्यसञ्चालन केन्द्र (NEOC)',
        'dashboardTitle' => 'आपतकालीन जोखिम व्यवस्थापन तथा क्षति विश्लेषण कमाण्ड सेन्टर',
        'totalLoss' => 'कुल प्रत्यक्ष आर्थिक क्षति (रु.)',
        'affectedHH' => 'प्रभावित परिवार संख्या',
        'casualties' => 'मानवीय क्षति',
        'restoration' => 'पुनर्स्थापना प्रगति',
        'newEntry' => 'नयाँ क्षति प्रविष्टि',
        'province' => 'प्रदेश',
        'district' => 'जिल्ला',
        'municipality' => 'नगरपालिका / गाउँपालिका',
        'ward' => 'वडा नं.',
        'hazard' => 'प्रकोपको प्रकार',
        'lossNpr' => 'आर्थिक क्षति (रु.)',
        'actions' => 'कार्यहरू',
        'viewReport' => 'प्रतिवेदन हेर्नुहोस्',
        'save' => 'प्रविष्टि सुरक्षित गर्नुहोस्',
    ]
];

function t($key) {
    global $UI, $lang;
    return $UI[$lang][$key] ?? $UI['en'][$key] ?? $key;
}
