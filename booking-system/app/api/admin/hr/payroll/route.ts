export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { HRStore } from '@/lib/hr-store';
import { HRPayroll } from '@/lib/hr-payroll-store';
import type { TerminationType } from '@/lib/hr-payroll-store';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const terminationType = (searchParams.get('terminationType') as TerminationType) || 'EMPLOYER_TERMINATION';

    if (employeeId) {
        // Single employee payroll
        const employee = await HRStore.getById(employeeId);
        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        const salary = HRPayroll.calculateSalary(employee);
        const leaveBalance = HRPayroll.calculateLeaveBalance(employee);
        const gratuity = HRPayroll.calculateGratuity(employee);
        const eos = HRPayroll.calculateEndOfService(employee, terminationType);

        return NextResponse.json({
            employee: {
                id: employee.id,
                name: `${employee.firstName} ${employee.lastName}`,
                employeeCode: employee.employeeCode,
                designation: employee.designation,
                joiningDate: employee.joiningDate,
            },
            salary,
            leaveBalance,
            gratuity,
            endOfService: eos,
        });
    }

    // All employees payroll summary
    const viewType = searchParams.get('viewType') || 'active'; // 'active' or 'separated'
    
    let employees;
    if (viewType === 'separated') {
        const all = await HRStore.getAll();
        employees = all.filter(e => e.status === 'RESIGNED' || e.status === 'TERMINATED');
    } else {
        employees = await HRStore.getAll({ status: 'ACTIVE' });
    }

    const payrollSummary = employees.map(emp => {
        const salary = HRPayroll.calculateSalary(emp);
        const leaveBalance = HRPayroll.calculateLeaveBalance(emp);
        const gratuity = HRPayroll.calculateGratuity(emp);

        let endOfService = null;
        if (viewType === 'separated') {
            const termType: TerminationType = emp.status === 'RESIGNED' ? 'RESIGNATION' : 'EMPLOYER_TERMINATION';
            endOfService = HRPayroll.calculateEndOfService(emp, termType);
        }

        return {
            id: emp.id,
            employeeCode: emp.employeeCode,
            name: `${emp.firstName} ${emp.lastName}`,
            designation: emp.designation,
            department: emp.department,
            joiningDate: emp.joiningDate,
            status: emp.status,
            grossSalary: salary.grossSalary,
            basicSalary: salary.basicSalary,
            housingAllowance: salary.housingAllowance,
            transportAllowance: salary.transportAllowance,
            workAllowance: salary.workAllowance || 0,
            trainingAllowance: salary.trainingAllowance || 0,
            otherAllowances: salary.otherAllowances,
            remainingLeave: leaveBalance.remainingAnnualLeave,
            leaveEncashment: leaveBalance.leaveEncashmentAmount,
            gratuityAccrued: gratuity.gratuityAmount,
            yearsOfService: gratuity.yearsOfService,
            endOfService
        };
    });

    return NextResponse.json(payrollSummary);
}
