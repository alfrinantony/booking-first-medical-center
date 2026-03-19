export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { CategoryImageStore } from '@/lib/services-store';

/**
 * GET /api/admin/category-images
 * Returns all category → image URL mappings
 */
export async function GET() {
    return NextResponse.json(await CategoryImageStore.getAll());
}

/**
 * POST /api/admin/category-images
 * { category: string, imageUrl: string }
 * Sets the image for a category
 */
export async function POST(request: Request) {
    try {
        const { category, imageUrl } = await request.json();
        if (!category || !imageUrl) {
            return NextResponse.json({ error: 'Missing category or imageUrl' }, { status: 400 });
        }
        await CategoryImageStore.set(category, imageUrl);
        return NextResponse.json({ success: true, category, imageUrl });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/category-images?category=xyz
 * Removes the image for a category
 */
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    if (!category) {
        return NextResponse.json({ error: 'Missing category param' }, { status: 400 });
    }
    await CategoryImageStore.remove(category);
    return NextResponse.json({ success: true });
}
