export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { maskPhone, maskEmail } from '@/lib/emr-store';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { endpointUrl, apiKey, patientData, maskContacts } = body;

        if (!endpointUrl || !apiKey) {
            return NextResponse.json(
                { success: false, error: 'EMR endpoint URL and API Key are required.' },
                { status: 400 }
            );
        }

        if (!patientData) {
            return NextResponse.json(
                { success: false, error: 'Patient data is required.' },
                { status: 400 }
            );
        }

        // Helper to optionally mask values
        const phone = (val: string | undefined) => maskContacts ? maskPhone(val) : val;
        const email = (val: string | undefined) => maskContacts ? maskEmail(val) : val;

        // Build a standard patient record payload
        const emrPayload = {
            resourceType: 'Patient',
            identifier: [
                ...(patientData.emiratesIdNumber ? [{
                    system: 'urn:oid:2.16.784.1.101.10.1',
                    value: patientData.emiratesIdNumber,
                    type: { text: 'Emirates ID' }
                }] : []),
                ...(patientData.passportNo ? [{
                    system: 'urn:oid:2.16.840.1.113883.4.330',
                    value: patientData.passportNo,
                    type: { text: 'Passport' }
                }] : []),
            ],
            name: [{
                family: patientData.lastName || '',
                given: [patientData.firstName, patientData.middleName].filter(Boolean),
                text: patientData.name || '',
            }],
            gender: patientData.gender?.toLowerCase() || 'unknown',
            birthDate: patientData.dateOfBirth || undefined,
            telecom: [
                ...(patientData.mobile ? [{ system: 'phone', value: phone(patientData.mobile), use: 'mobile' }] : []),
                ...(patientData.whatsapp ? [{ system: 'phone', value: phone(patientData.whatsapp), use: 'home' }] : []),
                ...(patientData.email ? [{ system: 'email', value: email(patientData.email) }] : []),
            ],
            address: patientData.address ? [{
                text: patientData.address,
                city: patientData.city || undefined,
                state: patientData.emirates || undefined,
                country: patientData.country || 'AE',
                postalCode: patientData.poBox || undefined,
            }] : [],
            maritalStatus: patientData.civilStatus ? { text: patientData.civilStatus } : undefined,
            communication: patientData.language ? [{ language: { text: patientData.language } }] : [],
            contact: patientData.emergencyContactPerson ? [{
                name: { text: patientData.emergencyContactPerson },
                relationship: [{ text: patientData.emergencyRelationship || 'Emergency Contact' }],
                telecom: [
                    ...(patientData.emergencyTelephone ? [{ system: 'phone', value: patientData.emergencyTelephone }] : []),
                    ...(patientData.emergencyWorkMobile ? [{ system: 'phone', value: patientData.emergencyWorkMobile, use: 'work' }] : []),
                ],
            }] : [],
            extension: [
                ...(patientData.nationality ? [{ url: 'nationality', valueString: patientData.nationality }] : []),
                ...(patientData.religion ? [{ url: 'religion', valueString: patientData.religion }] : []),
                ...(patientData.profession ? [{ url: 'profession', valueString: patientData.profession }] : []),
                ...(patientData.citizenship ? [{ url: 'citizenship', valueString: patientData.citizenship }] : []),
                ...(patientData.race ? [{ url: 'race', valueString: patientData.race }] : []),
                ...(patientData.ethnicGroup ? [{ url: 'ethnicGroup', valueString: patientData.ethnicGroup }] : []),
                ...(patientData.residentType ? [{ url: 'residentType', valueString: patientData.residentType }] : []),
                ...(patientData.clientClass ? [{ url: 'clientClass', valueString: patientData.clientClass }] : []),
            ],
            // Attach document references (Emirates ID images)
            photo: [
                ...(patientData.idFrontBase64 ? [{ contentType: 'image/jpeg', data: patientData.idFrontBase64.split(',')[1], title: 'Emirates ID Front' }] : []),
                ...(patientData.idBackBase64 ? [{ contentType: 'image/jpeg', data: patientData.idBackBase64.split(',')[1], title: 'Emirates ID Back' }] : []),
            ],
        };

        // Forward to the external EMR system
        const emrResponse = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/fhir+json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(emrPayload),
        });

        if (!emrResponse.ok) {
            const errorText = await emrResponse.text().catch(() => 'Unknown error');
            return NextResponse.json({
                success: false,
                error: `EMR responded with status ${emrResponse.status}: ${errorText}`,
            });
        }

        const emrResult = await emrResponse.json().catch(() => ({}));

        return NextResponse.json({
            success: true,
            emrReferenceId: emrResult.id || `EMR-${Date.now()}`,
            message: 'Patient record pushed to EMR successfully.',
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
