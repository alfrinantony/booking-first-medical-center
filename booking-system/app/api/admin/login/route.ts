import { NextRequest, NextResponse } from 'next/server';
import { UsersStore } from '@/lib/users-store';

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password are required' },
                { status: 400 }
            );
        }

        const user = await UsersStore.login(username, password);

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid username or password' },
                { status: 401 }
            );
        }

        // Return user without password (sessionToken is included)
        const { password: _pw, ...safeUser } = user;
        return NextResponse.json(safeUser);
    } catch {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
