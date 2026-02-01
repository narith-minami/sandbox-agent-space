import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

export async function GET() {
  try {
    // Check if archived column exists
    const columns = await db.execute(sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position;
    `);

    // Check sample data
    const sampleData = await db.execute(sql`
      SELECT id, status, archived
      FROM sessions
      LIMIT 5;
    `);

    // Count sessions by archived status
    const counts = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN archived = true THEN 1 END) as archived_true,
        COUNT(CASE WHEN archived = false THEN 1 END) as archived_false,
        COUNT(CASE WHEN archived IS NULL THEN 1 END) as archived_null
      FROM sessions;
    `);

    return NextResponse.json({
      columns: columns.rows,
      sampleData: sampleData.rows,
      counts: counts.rows[0],
    });
  } catch (error) {
    console.error('Database check error:', error);
    return NextResponse.json(
      { error: 'Failed to check database', details: String(error) },
      { status: 500 }
    );
  }
}
