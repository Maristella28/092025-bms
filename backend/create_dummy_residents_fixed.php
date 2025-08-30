<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Resident;
use Carbon\Carbon;

echo "Creating dummy residents for testing reporting functionality...\n";

// Required fields based on validation rules
$requiredFields = [
    'birth_date' => '2000-01-01',
    'birth_place' => 'Test City',
    'age' => 25,
    'mobile_number' => '09123456789'
];

// Create Active Residents (last modified within 6 months)
for ($i = 1; $i <= 3; $i++) {
    $data = array_merge($requiredFields, [
        'resident_id' => 'ACTIVE' . str_pad($i, 3, '0', STR_PAD_LEFT),
        'first_name' => 'Active Resident ' . $i,
        'last_name' => 'Test',
        'email' => 'active' . $i . '@test.com',
        'sex' => 'Male',
        'civil_status' => 'Single',
        'religion' => 'Test Religion',
        'current_address' => 'Test Address',
        'years_in_barangay' => 5,
        'voter_status' => 'Registered',
        'household_no' => 'H' . $i,
        'last_modified' => Carbon::now()->subMonths(rand(0, 5)),
    ]);
    
    $resident = Resident::create($data);
    echo "Created Active Resident: {$resident->first_name} {$resident->last_name}\n";
}

// Create Outdated Residents (last modified 6-12 months ago)
for ($i = 1; $i <= 3; $i++) {
    $data = array_merge($requiredFields, [
        'resident_id' => 'OUTDATED' . str_pad($i, 3, '0', STR_PAD_LEFT),
        'first_name' => 'Outdated Resident ' . $i,
        'last_name' => 'Test',
        'email' => 'outdated' . $i . '@test.com',
        'sex' => 'Female',
        'civil_status' => 'Married',
        'religion' => 'Test Religion',
        'current_address' => 'Test Address',
        'years_in_barangay' => 8,
        'voter_status' => 'Registered',
        'household_no' => 'H' . ($i + 3),
        'last_modified' => Carbon::now()->subMonths(rand(6, 11)),
    ]);
    
    $resident = Resident::create($data);
    echo "Created Outdated Resident: {$resident->first_name} {$resident->last_name}\n";
}

// Create Needs Verification Residents (last modified over 12 months ago)
for ($i = 1; $i <= 3; $i++) {
    $data = array_merge($requiredFields, [
        'resident_id' => 'NEEDSVER' . str_pad($i, 3, '0', STR_PAD_LEFT),
        'first_name' => 'Needs Verification Resident ' . $i,
        'last_name' => 'Test',
        'email' => 'needsver' . $i . '@test.com',
        'sex' => 'Male',
        'civil_status' => 'Widowed',
        'religion' => 'Test Religion',
        'current_address' => 'Test Address',
        'years_in_barangay' => 15,
        'voter_status' => 'Not Registered',
        'household_no' => 'H' . ($i + 6),
        'last_modified' => Carbon::now()->subMonths(13),
    ]);
    
    $resident = Resident::create($data);
    echo "Created Needs Verification Resident: {$resident->first_name} {$resident->last_name}\n";
}

echo "Dummy residents created successfully!\n";
echo "Total residents in database: " . Resident::count() . "\n";
