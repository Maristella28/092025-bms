<?php

namespace App\Http\Controllers;

use App\Models\Beneficiary;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BeneficiaryController extends Controller
{
    /**
     * Get enabled beneficiaries for the My Benefits section
     */
    public function getMyBenefits(Request $request)
    {
        $query = Beneficiary::with(['program'])
            ->where('my_benefits_enabled', true)
            ->where('status', 'Approved');

        // If resident_id is provided, filter by it
        if ($request->has('resident_id')) {
            $query->where('resident_id', $request->resident_id);
        }

        return response()->json($query->orderByDesc('id')->get());
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
    $query = Beneficiary::with(['program', 'resident']);
        if ($request->has('beneficiary_type')) {
            $query->where('beneficiary_type', $request->beneficiary_type);
        }
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        if ($request->has('assistance_type')) {
            $query->where('assistance_type', $request->assistance_type);
        }
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%$search%")
                  ->orWhere('email', 'like', "%$search%")
                  ->orWhere('contact_number', 'like', "%$search%")
                  ->orWhere('full_address', 'like', "%$search%")
                  ->orWhere('remarks', 'like', "%$search%")
                  ->orWhere('beneficiary_type', 'like', "%$search%")
                  ->orWhere('assistance_type', 'like', "%$search%")
                  ->orWhere('status', 'like', "%$search%")
                  ;
            });
        }
        return response()->json($query->orderByDesc('id')->get());
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'program_id' => 'nullable|exists:programs,id',
            'name' => 'required|string',
            'beneficiary_type' => 'required|string',
            'status' => 'string',
            'assistance_type' => 'required|string',
            'amount' => 'nullable|numeric',
            'contact_number' => 'nullable|string',
            'email' => 'nullable|email',
            'full_address' => 'nullable|string',
            'application_date' => 'nullable|date',
            'approved_date' => 'nullable|date',
            'remarks' => 'nullable|string',
            'attachment' => 'nullable|file',
        ]);

        // Enforce max_beneficiaries limit
        if (!empty($data['program_id'])) {
            $program = \App\Models\Program::find($data['program_id']);
            if ($program && $program->max_beneficiaries) {
                $currentCount = \App\Models\Beneficiary::where('program_id', $program->id)->count();
                if ($currentCount >= $program->max_beneficiaries) {
                    return response()->json(['message' => 'Maximum number of beneficiaries reached for this program.'], 422);
                }
            }
        }
        if ($request->hasFile('attachment')) {
            $data['attachment'] = $request->file('attachment')->store('attachments');
        }
        $beneficiary = Beneficiary::create($data);
        $beneficiary->load('program');
        return response()->json($beneficiary, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $beneficiary = Beneficiary::with(['disbursements', 'program'])->findOrFail($id);
        return response()->json($beneficiary);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Beneficiary $beneficiary)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $beneficiary = Beneficiary::findOrFail($id);
        $data = $request->validate([
            'program_id' => 'nullable|exists:programs,id',
            'name' => 'sometimes|required|string',
            'beneficiary_type' => 'sometimes|required|string',
            'status' => 'string',
            'assistance_type' => 'sometimes|required|string',
            'amount' => 'nullable|numeric',
            'contact_number' => 'nullable|string',
            'email' => 'nullable|email',
            'full_address' => 'nullable|string',
            'application_date' => 'nullable|date',
            'approved_date' => 'nullable|date',
            'remarks' => 'nullable|string',
            'attachment' => 'nullable|file',
            'my_benefits_enabled' => 'boolean',
        ]);
        if ($request->hasFile('attachment')) {
            if ($beneficiary->attachment) {
                Storage::delete($beneficiary->attachment);
            }
            $data['attachment'] = $request->file('attachment')->store('attachments');
        }
        $beneficiary->update($data);
        $beneficiary->load('program');
        return response()->json($beneficiary);
    }

    /**
     * Remove the specified resource from storage.
     */
    /**
     * Toggle My Benefits status for a beneficiary
     */
    public function toggleMyBenefits(Request $request, $id)
    {
        $beneficiary = Beneficiary::findOrFail($id);
        
        // Validate the request
        $data = $request->validate([
            'enabled' => 'required|boolean',
        ]);

        // Only allow enabling if the beneficiary is approved
        if ($data['enabled'] && $beneficiary->status !== 'Approved') {
            return response()->json([
                'message' => 'Only approved beneficiaries can be enabled for My Benefits',
                'enabled' => false
            ], 422);
        }

        // Update the beneficiary
        $beneficiary->my_benefits_enabled = $data['enabled'];
        $beneficiary->save();

        // Return the updated status
        return response()->json([
            'message' => 'My Benefits status updated successfully',
            'enabled' => $beneficiary->my_benefits_enabled
        ]);
    }

    public function destroy($id)
    {
        $beneficiary = Beneficiary::findOrFail($id);
        if ($beneficiary->attachment) {
            Storage::delete($beneficiary->attachment);
        }
        $beneficiary->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
